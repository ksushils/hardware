import "server-only";
import Stripe from "stripe";
import type { Order, OrderItem } from "@prisma/client";
import { db } from "./db";
import { warrantyPrice } from "./pricing";

export const stripeEnabled = () => !!process.env.STRIPE_SECRET_KEY;
let _stripe: Stripe | null = null;
export function stripe() {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  return _stripe;
}
export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

/** Creates a Stripe Checkout session in AED (supports cards, Apple Pay and Google Pay). */
export async function createStripeCheckout(order: Order & { items: OrderItem[] }) {
  const fils = (n: number) => Math.round(n * 100);
  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = order.items.map((i) => ({
    quantity: i.quantity,
    price_data: {
      currency: "aed",
      unit_amount: fils(i.price + (i.warranty ? warrantyPrice(i.price) : 0)),
      product_data: { name: `${i.name} (${i.condition})${i.warranty ? " + Extended warranty" : ""}` },
    },
  }));
  if (order.shipping > 0)
    line_items.push({ quantity: 1, price_data: { currency: "aed", unit_amount: fils(order.shipping), product_data: { name: "Delivery" } } });

  let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
  if (order.discount > 0) {
    const coupon = await stripe().coupons.create({ amount_off: fils(order.discount), currency: "aed", duration: "once", name: order.couponCode ?? "Discount" });
    discounts = [{ coupon: coupon.id }];
  }

  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    customer_email: order.email,
    line_items,
    discounts,
    client_reference_id: order.number,
    metadata: { orderNumber: order.number },
    success_url: `${siteUrl()}/order/${order.number}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl()}/order/${order.number}?cancelled=1`,
  });
  await db.order.update({ where: { id: order.id }, data: { paymentRef: session.id } });
  return session.url!;
}

/** Idempotently marks an order as paid. */
export async function markOrderPaid(number: string, ref: string) {
  const order = await db.order.findUnique({ where: { number } });
  if (!order || order.paymentStatus === "PAID") return order;
  return db.order.update({
    where: { number },
    data: { paymentStatus: "PAID", status: "PAID", paymentRef: ref },
  });
}

export async function verifyStripeSession(number: string, sessionId: string) {
  if (!stripeEnabled()) return;
  const s = await stripe().checkout.sessions.retrieve(sessionId);
  if (s.metadata?.orderNumber === number && s.payment_status === "paid") await markOrderPaid(number, s.id);
}

/** Luhn check used by the built-in demo card gateway. */
export function luhn(num: string) {
  const digits = num.replace(/\D/g, "");
  if (digits.length < 12 || digits.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

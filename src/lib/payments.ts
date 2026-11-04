import "server-only";
import Stripe from "stripe";
import type { Order, OrderItem } from "@prisma/client";
import { db } from "./db";
import { siteUrl } from "./site";

export { siteUrl };
export const stripeEnabled = () => !!process.env.STRIPE_SECRET_KEY;
/**
 * The built-in demo card page (test cards only, no real money). It stays ON while no Stripe key is set so the site can be tested.
 * Set DISABLE_DEMO_PAYMENTS=1 to switch it off for real trading; card checkout is then hidden until Stripe is connected.
 */
export const demoPaymentsEnabled = () => !stripeEnabled() && process.env.DISABLE_DEMO_PAYMENTS !== "1";
export const cardPaymentsAvailable = () => stripeEnabled() || demoPaymentsEnabled();
let _stripe: Stripe | null = null;
export function stripe() {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  return _stripe;
}
const fils = (n: number) => Math.round(n * 100);

/** Creates a Stripe Checkout session in AED for the amount due (supports cards, Apple Pay and Google Pay). */
export async function createStripeCheckout(order: Order & { items: OrderItem[] }) {
  // Charge one line for the full amount due: discounts, gift cards, shipping and fees are already included in order.total.
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    customer_email: order.email,
    locale: order.locale === "ar" ? "auto" : "en",
    line_items: [{
      quantity: 1,
      price_data: { currency: "aed", unit_amount: fils(order.total), product_data: { name: `Order ${order.number}`, description: order.items.map((i) => `${i.name} × ${i.quantity}`).join(", ").slice(0, 500) } },
    }],
    client_reference_id: order.number,
    metadata: { orderNumber: order.number },
    success_url: `${siteUrl()}/order/${order.number}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl()}/order/${order.number}?cancelled=1`,
  });
  await db.order.update({ where: { id: order.id }, data: { paymentRef: session.id } });
  return session.url!;
}

export async function verifyStripeSession(number: string, sessionId: string) {
  if (!stripeEnabled()) return;
  const { markOrderPaid } = await import("./orders");
  const s = await stripe().checkout.sessions.retrieve(sessionId);
  if (s.metadata?.orderNumber === number && s.payment_status === "paid") await markOrderPaid(number, String(s.payment_intent ?? s.id));
}

/** Refunds through Stripe when the order was paid by Stripe; otherwise it's a manual refund (bank transfer / cash). */
export async function refundPayment(order: Order, amount: number): Promise<{ ok: boolean; ref?: string; error?: string; manual?: boolean }> {
  if (!stripeEnabled() || order.paymentMethod !== "CARD" || !order.paymentRef?.startsWith("pi_")) return { ok: true, manual: true };
  try {
    const r = await stripe().refunds.create({ payment_intent: order.paymentRef, amount: fils(amount) });
    return { ok: true, ref: r.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
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

"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { clearCart, getCartDetails } from "@/lib/cart";
import { computeTotals } from "@/lib/pricing";
import { EMIRATES } from "@/lib/format";
import { canViewOrder, newOrderNumber, rememberOrder, restock } from "@/lib/orders";
import { createStripeCheckout, luhn, markOrderPaid, stripeEnabled } from "@/lib/payments";
import type { FormState } from "./auth";

async function findCoupon(code: string) {
  if (!code) return null;
  const c = await db.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!c || !c.active || (c.expiresAt && c.expiresAt < new Date())) return null;
  return c;
}

export async function checkCoupon(code: string, subtotal: number) {
  const c = await findCoupon(code);
  if (!c) return { error: "This coupon is invalid or has expired." };
  if (subtotal < c.minSpend) return { error: `Minimum spend for ${c.code} is AED ${c.minSpend}.` };
  return { coupon: { code: c.code, type: c.type, value: c.value, minSpend: c.minSpend } };
}

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  fullName: z.string().trim().min(2, "Full name is required"),
  phone: z.string().trim().regex(/^(\+971|0)?5\d{8}$/, "Enter a valid UAE mobile number, e.g. 0501234567"),
  emirate: z.enum(EMIRATES as [string, ...string[]], { message: "Select an emirate" }),
  area: z.string().trim().min(2, "Area is required"),
  street: z.string().trim().min(2, "Street is required"),
  building: z.string().trim().min(1, "Building / villa is required"),
  notes: z.string().trim().max(500).optional(),
  shippingMethod: z.enum(["STANDARD", "EXPRESS"]),
  paymentMethod: z.enum(["CARD", "COD"]),
  couponCode: z.string().optional(),
});

export async function placeOrder(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;
  const user = await getUser();
  const { items } = await getCartDetails();
  if (!items.length) return { error: "Your cart is empty." };
  if (items.some((i) => i.quantity < i.requested)) return { error: "Some items have limited stock. Please review your cart." };
  if (data.shippingMethod === "EXPRESS" && !items.every((i) => i.product.express))
    return { error: "Express delivery is only available when every item in the cart is marked Express." };
  const subtotalForCoupon = items.reduce((s, i) => s + i.variant.price * i.quantity, 0);
  if (data.paymentMethod === "COD" && subtotalForCoupon > 5000) return { error: "Cash on delivery is only available for orders up to AED 5,000." };

  const coupon = data.couponCode ? await findCoupon(data.couponCode) : null;
  const totals = computeTotals(
    items.map((i) => ({ price: i.variant.price, quantity: i.quantity, warranty: i.warranty })),
    { shippingMethod: data.shippingMethod, paymentMethod: data.paymentMethod, coupon },
  );

  let order;
  try {
    order = await db.$transaction(async (tx) => {
      for (const i of items) {
        const res = await tx.variant.updateMany({
          where: { id: i.variant.id, stock: { gte: i.quantity } },
          data: { stock: { decrement: i.quantity } },
        });
        if (res.count === 0) throw new Error(`${i.product.name} just went out of stock.`);
      }
      return tx.order.create({
        data: {
          number: newOrderNumber(),
          userId: user?.id,
          email: user?.email ?? data.email,
          paymentMethod: data.paymentMethod,
          status: data.paymentMethod === "COD" ? "PROCESSING" : "PENDING",
          subtotal: totals.subtotal,
          discount: totals.discount,
          shipping: totals.shipping,
          vat: totals.vat,
          total: totals.total,
          couponCode: totals.discount > 0 ? coupon?.code : null,
          shippingMethod: data.shippingMethod,
          fullName: data.fullName, phone: data.phone, emirate: data.emirate,
          area: data.area, street: data.street, building: data.building, notes: data.notes || null,
          items: {
            create: items.map((i) => ({
              variantId: i.variant.id, name: `${i.product.brand} ${i.product.name}`, condition: i.variant.condition,
              image: i.product.image, price: i.variant.price, quantity: i.quantity, warranty: i.warranty,
            })),
          },
        },
        include: { items: true },
      });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not place order." };
  }

  // Save the address to the account for next time
  if (user && formData.get("saveAddress") === "on") {
    const exists = await db.address.findFirst({ where: { userId: user.id, street: data.street, building: data.building } });
    if (!exists) {
      const count = await db.address.count({ where: { userId: user.id } });
      await db.address.create({
        data: { userId: user.id, fullName: data.fullName, phone: data.phone, emirate: data.emirate, area: data.area, street: data.street, building: data.building, isDefault: count === 0 },
      });
    }
  }

  await clearCart();
  await rememberOrder(order.number);
  revalidatePath("/", "layout");

  if (data.paymentMethod === "CARD") {
    if (stripeEnabled()) redirect(await createStripeCheckout(order));
    redirect(`/checkout/pay/${order.number}`);
  }
  redirect(`/order/${order.number}?placed=1`);
}

/** Retry payment for a pending card order. */
export async function retryPayment(formData: FormData) {
  const number = String(formData.get("number"));
  const order = await db.order.findUnique({ where: { number }, include: { items: true } });
  if (!order || !(await canViewOrder(order)) || order.paymentStatus === "PAID" || order.status === "CANCELLED") redirect("/");
  if (stripeEnabled()) redirect(await createStripeCheckout(order));
  redirect(`/checkout/pay/${number}`);
}

export async function cancelOrder(formData: FormData) {
  const number = String(formData.get("number"));
  const order = await db.order.findUnique({ where: { number } });
  if (!order || !(await canViewOrder(order))) return;
  if (!["PENDING", "PROCESSING"].includes(order.status) || order.paymentStatus === "PAID") return;
  await db.order.update({ where: { number }, data: { status: "CANCELLED" } });
  await restock(order.id);
  revalidatePath(`/order/${number}`);
}

/**
 * Built-in demo card gateway, used when no Stripe key is configured.
 * Test cards: 4242 4242 4242 4242 succeeds, 4000 0000 0000 0002 is declined.
 */
export async function payWithDemoCard(_: FormState, formData: FormData): Promise<FormState> {
  if (stripeEnabled()) return { error: "Demo gateway is disabled." };
  const number = String(formData.get("number"));
  const order = await db.order.findUnique({ where: { number } });
  if (!order || !(await canViewOrder(order))) return { error: "Order not found." };
  if (order.paymentStatus === "PAID") redirect(`/order/${number}?placed=1`);
  const card = String(formData.get("card") || "").replace(/\s/g, "");
  const exp = String(formData.get("exp") || "");
  const cvc = String(formData.get("cvc") || "");
  if (!luhn(card)) return { error: "Card number is invalid." };
  const m = exp.match(/^(\d{2})\s*\/\s*(\d{2})$/);
  if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) return { error: "Expiry must be in MM/YY format." };
  const expDate = new Date(2000 + Number(m[2]), Number(m[1]), 1);
  if (expDate < new Date()) return { error: "Card has expired." };
  if (!/^\d{3,4}$/.test(cvc)) return { error: "CVC is invalid." };
  if (card === "4000000000000002") {
    await db.order.update({ where: { number }, data: { paymentStatus: "FAILED" } });
    return { error: "Your card was declined. Please try another card." };
  }
  await markOrderPaid(number, `demo_${Date.now()}`);
  redirect(`/order/${number}?placed=1`);
}

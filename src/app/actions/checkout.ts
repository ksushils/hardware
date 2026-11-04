"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { clearCart, getCartDetails, readCart } from "@/lib/cart";
import { computeTotals, warrantyPrice } from "@/lib/pricing";
import { EMIRATES } from "@/lib/format";
import { getI18n } from "@/lib/i18n";
import { getSettings, pricingConfig } from "@/lib/settings";
import { availableRates } from "@/lib/shipping";
import { bestAutomaticDiscount, evaluateDiscount, findCodeDiscount, type AppliedDiscount } from "@/lib/discounts";
import { canViewOrder, cancelOrderInternal, markOrderPaid, newOrderNumber, rememberOrder } from "@/lib/orders";
import { createStripeCheckout, luhn, stripeEnabled } from "@/lib/payments";
import { orderEvent } from "@/lib/activity";
import { sendOrderEmail } from "@/lib/emails";
import { createSellerOrders } from "@/lib/marketplace";
import type { FormState } from "./auth";

async function cartLines() {
  const { items } = await getCartDetails();
  return { items, lines: items.map((i) => ({ productId: i.product.id, price: i.variant.price, quantity: i.quantity })) };
}

/** Validates a discount code against the current cart. */
export async function applyDiscountCode(code: string, email?: string): Promise<{ discount?: AppliedDiscount; error?: string }> {
  const { t } = await getI18n();
  const d = await findCodeDiscount(code);
  if (!d || d.method !== "CODE") return { error: t.checkout.errors.expired };
  const { lines } = await cartLines();
  const user = await getUser();
  const r = await evaluateDiscount(d, lines, user?.email ?? email);
  return r.ok ? { discount: r.applied } : { error: t.checkout.errors[r.error] ?? t.checkout.errors.expired };
}

export async function checkGiftCard(code: string): Promise<{ code?: string; balance?: number; error?: string }> {
  const { t } = await getI18n();
  const g = await db.giftCard.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!g || !g.active || g.balance <= 0 || (g.expiresAt && g.expiresAt < new Date())) return { error: t.checkout.errors.giftInvalid };
  return { code: g.code, balance: g.balance };
}

/** Records/updates the shopper's checkout so unconverted ones show up as abandoned checkouts. */
export async function recordCheckout(email: string | null) {
  const entries = await readCart();
  if (!entries.length) return;
  const { items } = await getCartDetails();
  const subtotal = items.reduce((s, i) => s + i.variant.price * i.quantity, 0);
  const jar = await cookies();
  let token = jar.get("tr_checkout")?.value;
  const user = await getUser();
  const { locale } = await getI18n();
  const data = { email: (user?.email ?? email ?? "").toLowerCase() || null, userId: user?.id, items: JSON.stringify(entries), subtotal, locale };
  const existing = token ? await db.checkout.findUnique({ where: { token } }) : null;
  if (existing && !existing.recoveredOrder) await db.checkout.update({ where: { token: existing.token }, data: { ...data, email: data.email ?? existing.email } });
  else {
    token = randomBytes(16).toString("hex");
    await db.checkout.create({ data: { ...data, token } });
    jar.set("tr_checkout", token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  }
}

export async function placeOrder(_: FormState, formData: FormData): Promise<FormState> {
  const { t, locale } = await getI18n();
  const s = await getSettings();
  const cfg = pricingConfig(s);
  const e = t.auth.errors;
  const schema = z.object({
    email: z.string().trim().toLowerCase().email(e.email),
    fullName: z.string().trim().min(2, e.name),
    phone: z.string().trim().regex(/^(\+971|0)?5\d{8}$/, e.phone),
    emirate: z.enum(EMIRATES as [string, ...string[]]),
    area: z.string().trim().min(2, t.checkout.area),
    street: z.string().trim().min(2, t.checkout.street),
    building: z.string().trim().min(1, t.checkout.building),
    notes: z.string().trim().max(500).optional(),
    rateId: z.string().min(1, t.checkout.noRates),
    paymentMethod: z.enum(["CARD", "COD"]),
    discountCode: z.string().optional(),
    giftCardCode: z.string().optional(),
  });
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;
  const user = await getUser();
  if (!user && !s.checkout.guestCheckout) redirect("/login?next=/checkout");
  if (data.paymentMethod === "COD" && !s.checkout.codEnabled) return { error: "COD disabled" };
  if (data.paymentMethod === "CARD" && !s.checkout.cardEnabled) return { error: "Card disabled" };

  const { items, lines } = await cartLines();
  if (!items.length) return { error: t.cart.empty };
  if (items.some((i) => i.quantity < i.requested)) return { error: t.cart.limited.replace("{n}", "") };
  const email = user?.email ?? data.email;

  // discounts: explicit code, else best automatic
  let applied: AppliedDiscount | null = null;
  if (data.discountCode) {
    const d = await findCodeDiscount(data.discountCode);
    const r = d ? await evaluateDiscount(d, lines, email) : null;
    if (!r?.ok) return { error: t.checkout.errors[r && !r.ok ? r.error : "expired"] ?? t.checkout.errors.expired };
    applied = r.applied;
  } else applied = await bestAutomaticDiscount(lines, email);

  const priced = items.map((i) => ({ price: i.variant.price, quantity: i.quantity, warranty: i.warranty }));
  const preSubtotal = computeTotals(priced, { cfg }).subtotal - (applied?.amount ?? 0);
  const allExpress = items.every((i) => i.product.express);
  const rates = await availableRates(data.emirate, preSubtotal, allExpress);
  const rate = rates.find((r) => r.id === data.rateId);
  if (!rate) return { error: t.checkout.noRates };

  let gift: { code: string; balance: number } | null = null;
  if (data.giftCardCode) {
    const g = await checkGiftCard(data.giftCardCode);
    if (g.error || !g.code) return { error: g.error };
    gift = { code: g.code, balance: g.balance! };
  }
  const totals = computeTotals(priced, { cfg, rate, paymentMethod: data.paymentMethod, discount: applied?.amount, freeShipping: applied?.freeShipping, giftCardBalance: gift?.balance });
  if (data.paymentMethod === "COD" && totals.total > s.checkout.codMax) return { error: t.checkout.codSub.replace("{amount}", `AED ${s.checkout.codMax}`) };
  const fullyCoveredByGiftCard = totals.total <= 0 && totals.giftCard > 0;

  let order;
  try {
    order = await db.$transaction(async (tx) => {
      for (const i of items) {
        if (!i.variant.trackInventory) continue;
        if (i.variant.continueSelling) {
          await tx.variant.update({ where: { id: i.variant.id }, data: { stock: { decrement: i.quantity } } });
        } else {
          const res = await tx.variant.updateMany({ where: { id: i.variant.id, stock: { gte: i.quantity } }, data: { stock: { decrement: i.quantity } } });
          if (res.count === 0) throw new Error(`${i.product.name}: ${t.common.soldOut}`);
        }
        await tx.inventoryAdjustment.create({ data: { variantId: i.variant.id, delta: -i.quantity, reason: "sold" } });
      }
      if (gift && totals.giftCard > 0) {
        const r = await tx.giftCard.updateMany({ where: { code: gift.code, balance: { gte: totals.giftCard } }, data: { balance: { decrement: totals.giftCard } } });
        if (r.count === 0) throw new Error(t.checkout.errors.giftInvalid);
      }
      if (applied) await tx.discount.update({ where: { id: applied.id }, data: { usedCount: { increment: 1 } } });
      return tx.order.create({
        data: {
          number: newOrderNumber(), userId: user?.id, email, locale,
          paymentMethod: fullyCoveredByGiftCard ? "GIFT_CARD" : data.paymentMethod,
          subtotal: totals.subtotal, discount: totals.discount, discountCode: applied ? (applied.code ?? applied.title) : null, discountTitle: applied?.title,
          shipping: totals.shipping, codFee: totals.codFee, giftCardCode: gift?.code, giftCardAmount: totals.giftCard, vat: totals.vat, total: totals.total,
          shippingRateName: rate.name, express: rate.expressOnly,
          fullName: data.fullName, phone: data.phone, emirate: data.emirate, area: data.area, street: data.street, building: data.building, customerNote: data.notes || null,
          items: {
            create: items.map((i) => ({
              variantId: i.variant.id, productId: i.product.id, name: `${i.product.brand} ${i.product.name}`, variantTitle: i.variant.title === "Default Title" ? "" : i.variant.title,
              sku: i.variant.sku, image: i.product.image, price: i.variant.price, cost: i.variant.cost, quantity: i.quantity, warranty: i.warranty,
              warrantyPrice: i.warranty ? warrantyPrice(i.variant.price, cfg) : 0,
            })),
          },
        },
        include: { items: true },
      });
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not place order." };
  }
  await orderEvent(order.id, "placed", `Order placed on the online store (${order.paymentMethod}, ${rate.name}).`);
  await createSellerOrders(order).catch((err) => console.error("seller split failed", err));

  if (user && formData.get("saveAddress") === "on") {
    const exists = await db.address.findFirst({ where: { userId: user.id, street: data.street, building: data.building } });
    if (!exists) {
      const count = await db.address.count({ where: { userId: user.id } });
      await db.address.create({ data: { userId: user.id, fullName: data.fullName, phone: data.phone, emirate: data.emirate, area: data.area, street: data.street, building: data.building, isDefault: count === 0 } });
    }
  }
  if (formData.get("marketing") === "on") {
    await db.subscriber.upsert({ where: { email }, update: {}, create: { email, locale, source: "checkout" } });
    if (user) await db.user.update({ where: { id: user.id }, data: { acceptsMarketing: true } });
  }
  const jar = await cookies();
  const token = jar.get("tr_checkout")?.value;
  if (token) await db.checkout.updateMany({ where: { token }, data: { recoveredOrder: order.number } });
  jar.delete("tr_checkout");
  await clearCart();
  await rememberOrder(order.number);
  revalidatePath("/", "layout");

  if (fullyCoveredByGiftCard) {
    await markOrderPaid(order.number, `gift_${gift!.code}`);
    redirect(`/order/${order.number}?placed=1`);
  }
  if (data.paymentMethod === "CARD") {
    if (stripeEnabled()) redirect(await createStripeCheckout(order));
    redirect(`/checkout/pay/${order.number}`);
  }
  await sendOrderEmail(order, "confirmation");
  redirect(`/order/${order.number}?placed=1`);
}

/** Retry payment for a pending card order (also used by draft-order invoices). */
export async function retryPayment(formData: FormData) {
  const number = String(formData.get("number"));
  const order = await db.order.findUnique({ where: { number }, include: { items: true } });
  if (!order || !(await canViewOrder(order, String(formData.get("k") || ""))) || order.paymentStatus === "PAID" || order.status === "CANCELLED") redirect("/");
  if (stripeEnabled()) redirect(await createStripeCheckout(order));
  redirect(`/checkout/pay/${number}`);
}

export async function cancelOrder(formData: FormData) {
  const number = String(formData.get("number"));
  const order = await db.order.findUnique({ where: { number } });
  if (!order || !(await canViewOrder(order, String(formData.get("k") || "")))) return;
  if (order.status !== "OPEN" || order.paymentStatus === "PAID" || order.fulfillmentStatus !== "UNFULFILLED") return;
  await cancelOrderInternal(order, "Cancelled by customer");
  revalidatePath(`/order/${number}`);
}

/** Built-in demo card gateway (no Stripe key). 4242 4242 4242 4242 succeeds, 4000 0000 0000 0002 declines. */
export async function payWithDemoCard(_: FormState, formData: FormData): Promise<FormState> {
  if (stripeEnabled()) return { error: "Demo gateway is disabled." };
  const { locale } = await getI18n();
  const ar = locale === "ar";
  const number = String(formData.get("number"));
  const order = await db.order.findUnique({ where: { number } });
  if (!order || !(await canViewOrder(order, String(formData.get("k") || "")))) return { error: "Order not found." };
  if (order.paymentStatus === "PAID") redirect(`/order/${number}?placed=1`);
  const card = String(formData.get("card") || "").replace(/\s/g, "");
  const exp = String(formData.get("exp") || "");
  const cvc = String(formData.get("cvc") || "");
  if (!luhn(card)) return { error: ar ? "رقم البطاقة غير صالح." : "Card number is invalid." };
  const m = exp.match(/^(\d{2})\s*\/\s*(\d{2})$/);
  if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) return { error: ar ? "يجب أن يكون تاريخ الانتهاء بصيغة MM/YY." : "Expiry must be in MM/YY format." };
  if (new Date(2000 + Number(m[2]), Number(m[1]), 1) < new Date()) return { error: ar ? "البطاقة منتهية." : "Card has expired." };
  if (!/^\d{3,4}$/.test(cvc)) return { error: ar ? "رمز التحقق غير صالح." : "CVC is invalid." };
  if (card === "4000000000000002") {
    await db.order.update({ where: { number }, data: { paymentStatus: "FAILED" } });
    await orderEvent(order.id, "payment_failed", "Card payment declined (demo gateway).");
    return { error: ar ? "تم رفض البطاقة. يرجى تجربة بطاقة أخرى." : "Your card was declined. Please try another card." };
  }
  await markOrderPaid(number, `demo_${Date.now()}`);
  redirect(`/order/${number}?placed=1`);
}

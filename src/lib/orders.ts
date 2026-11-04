import "server-only";
import { cookies } from "next/headers";
import type { Order, OrderItem } from "@prisma/client";
import { db } from "./db";
import { getUser } from "./auth";
import { isStaff } from "./permissions";
import { orderEvent } from "./activity";
import { sendOrderEmail } from "./emails";
import { postOrderPaidSafe } from "./ledgerPosting";
import { verifyOrderKey } from "./orderAccess";

const COOKIE = "tr_orders";
export type OrderWithItems = Order & { items: OrderItem[] };

export function newOrderNumber() {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `TR${ymd}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

/** Remember guest orders in this browser so the guest can view them. */
export async function rememberOrder(number: string) {
  const jar = await cookies();
  const list = (jar.get(COOKIE)?.value || "").split(",").filter(Boolean);
  list.unshift(number);
  jar.set(COOKIE, list.slice(0, 20).join(","), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 90 });
}

export async function canViewOrder(order: { number: string; userId: string | null }, key?: string | null) {
  if (verifyOrderKey(order.number, key)) {
    await rememberOrder(order.number).catch(() => null); // remember for follow-up actions (pay, cancel, return)
    return true;
  }
  const user = await getUser();
  if (user && (isStaff(user) || user.id === order.userId)) return true;
  const list = ((await cookies()).get(COOKIE)?.value || "").split(",");
  return list.includes(order.number);
}

export async function getOrder(number: string) {
  return db.order.findUnique({ where: { number }, include: { items: true, events: { orderBy: { createdAt: "desc" } }, refunds: true, returns: true } });
}

/** Adjusts a variant's stock and records an inventory adjustment. */
export async function adjustStock(variantId: string, delta: number, reason: string, userId?: string, note?: string) {
  if (!delta) return;
  const [v] = await db.$transaction([
    db.variant.update({ where: { id: variantId }, data: { stock: { increment: delta } }, include: { product: true } }),
    db.inventoryAdjustment.create({ data: { variantId, delta, reason, userId, note } }),
  ]);
  if (delta > 0 && v.stock > 0 && v.stock - delta <= 0) await notifyBackInStock(variantId).catch((e) => console.error("back-in-stock", e));
}

/** Emails shoppers who asked to be notified when this variant is available again. */
export async function notifyBackInStock(variantId: string) {
  const { getSettings } = await import("./settings");
  const { sendEmail, btn } = await import("./mailer");
  const { siteUrl } = await import("./site");
  const s = await getSettings();
  if (!s.notifications.backInStock) return;
  const v = await db.variant.findUnique({ where: { id: variantId }, include: { product: true } });
  if (!v || v.stock <= 0) return;
  const alerts = await db.stockAlert.findMany({ where: { variantId, notifiedAt: null } });
  for (const a of alerts) {
    const title = `${v.product.brand} ${v.product.name}${v.title !== "Default Title" ? ` (${v.title})` : ""}`;
    await sendEmail(a.email, `Back in stock: ${title}`, `<p>Good news! <b>${title}</b> is available again, at AED ${v.price}.</p><p>Stock is limited, especially for renewed items.</p>${btn(`${siteUrl()}/products/${v.product.slug}`, "Shop now")}`, "back_in_stock");
    await db.stockAlert.update({ where: { id: a.id }, data: { notifiedAt: new Date() } });
  }
}

/** Puts order items back into stock (cancel / refund with restock / return received). */
export async function restock(orderId: string, userId?: string, items?: { orderItemId: string; quantity: number }[]) {
  const all = await db.orderItem.findMany({ where: { orderId } });
  const list = items ? items.map((i) => ({ item: all.find((a) => a.id === i.orderItemId), qty: i.quantity })) : all.map((a) => ({ item: a, qty: a.quantity }));
  for (const { item, qty } of list) {
    if (!item?.variantId || qty <= 0) continue;
    const v = await db.variant.findUnique({ where: { id: item.variantId } });
    if (v?.trackInventory) await adjustStock(item.variantId, qty, "restock", userId, `Order ${orderId}`);
  }
}

/**
 * Idempotently marks an order as paid. Invoiced draft orders get their stock deducted here.
 * The confirmation email is skipped for COD/manual orders (already confirmed when placed).
 */
export async function markOrderPaid(number: string, ref: string, userId?: string) {
  const order = await db.order.findUnique({ where: { number }, include: { items: true } });
  if (!order || order.paymentStatus === "PAID") return order;
  if (order.status === "DRAFT") {
    for (const i of order.items) {
      if (!i.variantId) continue;
      const v = await db.variant.findUnique({ where: { id: i.variantId } });
      if (v?.trackInventory) await adjustStock(i.variantId, -i.quantity, "sold", userId, `Order ${order.number}`);
    }
  }
  const updated = await db.order.update({
    where: { number },
    data: { paymentStatus: "PAID", paymentRef: ref, paidAt: new Date(), status: order.status === "DRAFT" ? "OPEN" : order.status },
    include: { items: true },
  });
  await orderEvent(order.id, "paid", `Payment of AED ${order.total} captured (${order.paymentMethod}${ref ? `, ref ${ref}` : ""}).`, userId);
  await postOrderPaidSafe(order.id); // double-entry ledger (never blocks the order flow)
  if (order.status === "DRAFT" || ["CARD", "GIFT_CARD"].includes(order.paymentMethod)) await sendOrderEmail(updated, "confirmation");
  return updated;
}

export async function cancelOrderInternal(order: Order, reason: string, userId?: string, opts: { restock?: boolean } = { restock: true }) {
  if (order.status === "CANCELLED") return;
  await db.order.update({ where: { id: order.id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason, paymentStatus: order.paymentStatus === "PENDING" ? "VOIDED" : order.paymentStatus } });
  if (opts.restock !== false) await restock(order.id, userId);
  if (order.giftCardCode && order.giftCardAmount > 0)
    await db.giftCard.update({ where: { code: order.giftCardCode }, data: { balance: { increment: order.giftCardAmount } } }).catch(() => null);
  await orderEvent(order.id, "cancelled", `Order cancelled: ${reason}`, userId);
}

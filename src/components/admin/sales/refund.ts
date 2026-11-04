import "server-only";
import { db } from "@/lib/db";
import { orderEvent, logActivity } from "@/lib/activity";
import { restock } from "@/lib/orders";
import { refundPayment } from "@/lib/payments";
import { sendOrderEmail } from "@/lib/emails";

/** Shared refund logic used by the order page and returns. Returns an error string or null. */
export async function performRefund(
  orderId: string,
  amount: number,
  reason: string,
  restockItems: { orderItemId: string; quantity: number }[],
  user: { id: string; name: string },
  notify = true,
): Promise<string | null> {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return "Order not found.";
  const refundable = Math.round((order.total - order.refundedAmount) * 100) / 100;
  amount = Math.round((Number.isFinite(amount) ? amount : 0) * 100) / 100;
  const items = restockItems
    .map((r) => {
      const it = order.items.find((i) => i.id === r.orderItemId);
      return it ? { orderItemId: it.id, quantity: Math.max(0, Math.min(it.quantity, Math.floor(r.quantity))) } : null;
    })
    .filter((x): x is { orderItemId: string; quantity: number } => !!x && x.quantity > 0);
  if (amount < 0) return "Refund amount can't be negative.";
  if (amount > refundable + 0.001) return `You can refund at most AED ${refundable}.`;
  if (amount > 0 && !["PAID", "PARTIALLY_REFUNDED"].includes(order.paymentStatus)) return "Only paid orders can be refunded.";
  if (amount === 0 && !items.length) return "Enter a refund amount or choose items to restock.";

  let ref: string | undefined;
  if (amount > 0) {
    const res = await refundPayment(order, amount);
    if (!res.ok) return `Payment provider refused the refund: ${res.error}`;
    ref = res.ref;
  }
  await db.refund.create({ data: { orderId, amount, reason: reason || null, restock: items.length > 0 } });
  const refundedAmount = Math.round((order.refundedAmount + amount) * 100) / 100;
  const paymentStatus = amount > 0 ? (refundedAmount >= order.total - 0.005 ? "REFUNDED" : "PARTIALLY_REFUNDED") : order.paymentStatus;
  const updated = await db.order.update({ where: { id: orderId }, data: { refundedAmount, paymentStatus }, include: { items: true } });
  if (items.length) await restock(orderId, user.id, items);
  const restockMsg = items.length ? ` Restocked ${items.reduce((s, i) => s + i.quantity, 0)} item(s).` : "";
  await orderEvent(orderId, "refunded", `Refunded AED ${amount}${reason ? ` (${reason})` : ""}${ref ? `, ref ${ref}` : amount > 0 ? " (manual refund)" : ""}.${restockMsg}`, user.id);
  await logActivity(user, "refunded", "order", `Refunded AED ${amount} on order ${order.number}`, orderId);
  if (notify && amount > 0) await sendOrderEmail(updated, "refunded");
  return null;
}

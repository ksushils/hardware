"use server";
import { postOrderPaidSafe } from "@/lib/ledgerPosting";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { logActivity, orderEvent } from "@/lib/activity";
import { cancelOrderInternal, markOrderPaid } from "@/lib/orders";
import { sendOrderEmail } from "@/lib/emails";
import { EMIRATES, csv } from "@/lib/format";
import { performRefund } from "@/components/admin/sales/refund";
import { applySellerRefund, deliverSellerOrdersForOrder } from "@/lib/marketplace";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const back = (number: string, p: { msg?: string; error?: string }): never =>
  redirect(`/admin/orders/${number}?${new URLSearchParams(p as Record<string, string>).toString()}`);

async function load(fd: FormData) {
  const user = await requirePermission("orders");
  const number = s(fd, "number");
  const order = await db.order.findUnique({ where: { number }, include: { items: true } });
  if (!order) redirect("/admin/orders?error=Order%20not%20found");
  return { user, order };
}

export async function fulfillOrder(fd: FormData) {
  const { user, order } = await load(fd);
  if (order.status !== "OPEN") back(order.number, { error: "Only open orders can be fulfilled." });
  const trackingCompany = s(fd, "trackingCompany") || null;
  const trackingNumber = s(fd, "trackingNumber") || null;
  const trackingUrl = s(fd, "trackingUrl") || null;
  const updated = await db.order.update({
    where: { id: order.id },
    data: { fulfillmentStatus: "FULFILLED", fulfilledAt: new Date(), trackingCompany, trackingNumber, trackingUrl },
    include: { items: true },
  });
  await orderEvent(order.id, "fulfilled", `Items fulfilled${trackingNumber ? ` with ${trackingCompany ?? "carrier"} tracking ${trackingNumber}` : ""}.`, user.id);
  await logActivity(user, "fulfilled", "order", `Fulfilled order ${order.number}`, order.id);
  if (fd.get("notify") === "on") await sendOrderEmail(updated, "shipped");
  back(order.number, { msg: "Order fulfilled." });
}

export async function updateTracking(fd: FormData) {
  const { user, order } = await load(fd);
  await db.order.update({
    where: { id: order.id },
    data: { trackingCompany: s(fd, "trackingCompany") || null, trackingNumber: s(fd, "trackingNumber") || null, trackingUrl: s(fd, "trackingUrl") || null },
  });
  await orderEvent(order.id, "edited", "Tracking information updated.", user.id);
  back(order.number, { msg: "Tracking updated." });
}

export async function markDelivered(fd: FormData) {
  const { user, order } = await load(fd);
  if (order.status === "CANCELLED") back(order.number, { error: "Order is cancelled." });
  const codPaid = order.paymentMethod === "COD" && order.paymentStatus === "PENDING";
  const updated = await db.order.update({
    where: { id: order.id },
    data: {
      fulfillmentStatus: "DELIVERED", deliveredAt: new Date(), fulfilledAt: order.fulfilledAt ?? new Date(),
      ...(codPaid ? { paymentStatus: "PAID", paidAt: new Date(), paymentRef: "COD" } : {}),
    },
    include: { items: true },
  });
  await orderEvent(order.id, "delivered", "Order marked as delivered.", user.id);
  await deliverSellerOrdersForOrder(order.id);
  if (codPaid) {
    await orderEvent(order.id, "paid", `Cash on delivery of AED ${order.total} collected.`, user.id);
    await postOrderPaidSafe(order.id); // double-entry ledger: cash collected on delivery
  }
  await logActivity(user, "delivered", "order", `Marked order ${order.number} delivered`, order.id);
  if (fd.get("notify") !== "off") await sendOrderEmail(updated, "delivered");
  back(order.number, { msg: "Marked as delivered." });
}

export async function markPaid(fd: FormData) {
  const { user, order } = await load(fd);
  if (order.paymentStatus === "PAID") back(order.number, { error: "Order is already paid." });
  if (order.status === "CANCELLED") back(order.number, { error: "Order is cancelled." });
  await markOrderPaid(order.number, s(fd, "ref") || "manual", user.id);
  await logActivity(user, "paid", "order", `Marked order ${order.number} as paid`, order.id);
  back(order.number, { msg: "Marked as paid." });
}

export async function refundOrder(fd: FormData) {
  const { user, order } = await load(fd);
  const items = order.items.map((i) => ({ orderItemId: i.id, quantity: Number(fd.get(`restock_${i.id}`) || 0) }));
  const err = await performRefund(order.id, Number(fd.get("amount") || 0), s(fd, "reason"), items, user, fd.get("notify") === "on");
  if (!err) await applySellerRefund(order.id, Number(fd.get("amount") || 0));
  if (err) back(order.number, { error: err });
  back(order.number, { msg: "Refund recorded." });
}

export async function cancelOrder(fd: FormData) {
  const { user, order } = await load(fd);
  if (order.status === "CANCELLED") back(order.number, { error: "Order is already cancelled." });
  const reason = s(fd, "reason") || "Other";
  await cancelOrderInternal(order, reason, user.id, { restock: fd.get("restock") === "on" });
  await logActivity(user, "cancelled", "order", `Cancelled order ${order.number}: ${reason}`, order.id);
  if (fd.get("notify") === "on") {
    const updated = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } });
    await sendOrderEmail(updated, "cancelled");
  }
  const paid = ["PAID", "PARTIALLY_REFUNDED"].includes(order.paymentStatus);
  back(order.number, { msg: paid ? "Order cancelled. It was paid, so remember to issue a refund." : "Order cancelled." });
}

export async function archiveOrder(fd: FormData) {
  const { user, order } = await load(fd);
  const archive = s(fd, "archive") !== "0";
  if (archive && order.status !== "OPEN") back(order.number, { error: "Only open orders can be archived." });
  if (!archive && order.status !== "ARCHIVED") back(order.number, { error: "Order isn't archived." });
  await db.order.update({ where: { id: order.id }, data: { status: archive ? "ARCHIVED" : "OPEN" } });
  await orderEvent(order.id, "edited", archive ? "Order archived." : "Order unarchived.", user.id);
  await logActivity(user, archive ? "archived" : "unarchived", "order", `${archive ? "Archived" : "Unarchived"} order ${order.number}`, order.id);
  back(order.number, { msg: archive ? "Order archived." : "Order unarchived." });
}

export async function resendConfirmation(fd: FormData) {
  const { user, order } = await load(fd);
  await sendOrderEmail(order, "confirmation");
  await logActivity(user, "emailed", "order", `Resent confirmation for ${order.number}`, order.id);
  back(order.number, { msg: `Confirmation email sent to ${order.email}.` });
}

export async function updateOrderNote(fd: FormData) {
  const { user, order } = await load(fd);
  await db.order.update({ where: { id: order.id }, data: { note: s(fd, "note") || null } });
  await orderEvent(order.id, "edited", "Internal note updated.", user.id);
  back(order.number, { msg: "Note saved." });
}

export async function updateOrderTags(fd: FormData) {
  const { user, order } = await load(fd);
  const tags = csv(s(fd, "tags")).join(",");
  await db.order.update({ where: { id: order.id }, data: { tags } });
  await orderEvent(order.id, "edited", `Tags set to: ${tags || "none"}.`, user.id);
  back(order.number, { msg: "Tags saved." });
}

export async function updateOrderAddress(fd: FormData) {
  const { user, order } = await load(fd);
  const data = {
    fullName: s(fd, "fullName"), phone: s(fd, "phone"), emirate: s(fd, "emirate"),
    area: s(fd, "area"), street: s(fd, "street"), building: s(fd, "building"),
  };
  if (!data.fullName || !data.phone || !EMIRATES.includes(data.emirate)) back(order.number, { error: "Name, phone and a valid emirate are required." });
  await db.order.update({ where: { id: order.id }, data });
  await orderEvent(order.id, "edited", "Shipping address updated.", user.id);
  await logActivity(user, "updated", "order", `Updated shipping address on ${order.number}`, order.id);
  back(order.number, { msg: "Address updated." });
}

export async function addOrderComment(fd: FormData) {
  const { user, order } = await load(fd);
  const message = s(fd, "message");
  if (!message) back(order.number, { error: "Comment is empty." });
  await orderEvent(order.id, "note", `${user.name}: ${message}`, user.id);
  back(order.number, {});
}

export async function bulkOrders(fd: FormData) {
  const user = await requirePermission("orders");
  const ids = fd.getAll("ids").map(String);
  const action = s(fd, "action");
  const ret = s(fd, "return") || "/admin/orders";
  const sep = ret.includes("?") ? "&" : "?";
  if (!ids.length) redirect(`${ret}${sep}error=Select%20at%20least%20one%20order`);
  const orders = await db.order.findMany({ where: { id: { in: ids } } });
  let n = 0;
  for (const o of orders) {
    if (action === "fulfill" && o.status === "OPEN" && o.fulfillmentStatus === "UNFULFILLED") {
      await db.order.update({ where: { id: o.id }, data: { fulfillmentStatus: "FULFILLED", fulfilledAt: new Date() } });
      await orderEvent(o.id, "fulfilled", "Marked as fulfilled (bulk).", user.id);
      n++;
    } else if (action === "archive" && o.status === "OPEN") {
      await db.order.update({ where: { id: o.id }, data: { status: "ARCHIVED" } });
      await orderEvent(o.id, "edited", "Order archived (bulk).", user.id);
      n++;
    } else if (action === "unarchive" && o.status === "ARCHIVED") {
      await db.order.update({ where: { id: o.id }, data: { status: "OPEN" } });
      await orderEvent(o.id, "edited", "Order unarchived (bulk).", user.id);
      n++;
    } else if (action === "tag") {
      const tag = s(fd, "tag");
      if (!tag) continue;
      const tags = [...new Set([...csv(o.tags), ...csv(tag)])].join(",");
      await db.order.update({ where: { id: o.id }, data: { tags } });
      n++;
    } else if (action === "untag") {
      const remove = csv(s(fd, "tag"));
      await db.order.update({ where: { id: o.id }, data: { tags: csv(o.tags).filter((t) => !remove.includes(t)).join(",") } });
      n++;
    }
  }
  await logActivity(user, "bulk", "order", `Bulk "${action}" applied to ${n} order(s)`);
  redirect(`${ret}${sep}msg=${encodeURIComponent(`Updated ${n} order(s).`)}`);
}

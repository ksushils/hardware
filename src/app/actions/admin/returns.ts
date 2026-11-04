"use server";
import { orderUrl } from "@/lib/orderAccess";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { logActivity, orderEvent } from "@/lib/activity";
import { restock } from "@/lib/orders";
import { sendEmail, btn } from "@/lib/mailer";
import { siteUrl } from "@/lib/site";
import { performRefund } from "@/components/admin/sales/refund";
import { applySellerRefund } from "@/lib/marketplace";

const back = (id: string, p: Record<string, string>): never => redirect(`/admin/returns/${id}?${new URLSearchParams(p)}`);

async function load(fd: FormData) {
  const user = await requirePermission("orders");
  const id = String(fd.get("id"));
  const ret = await db.returnRequest.findUnique({ where: { id }, include: { order: { include: { items: true } } } });
  if (!ret) redirect("/admin/returns?error=Return%20not%20found");
  return { user, ret };
}

async function notify(ret: { order: { email: string; number: string; locale: string; fullName: string } }, status: string, note: string) {
  const ar = ret.order.locale === "ar";
  const msgs: Record<string, [string, string]> = {
    APPROVED: ["Your return request has been approved. Please pack the item(s) with all accessories. Our courier will contact you to arrange collection.", "تمت الموافقة على طلب الإرجاع. يرجى تغليف المنتجات مع جميع الملحقات وسيتواصل معك المندوب لترتيب الاستلام."],
    REJECTED: ["Unfortunately we can't accept your return request.", "نعتذر، لا يمكننا قبول طلب الإرجاع."],
    RECEIVED: ["We've received your returned item(s) and are inspecting them. Your refund will follow shortly.", "استلمنا المنتجات المرتجعة ونقوم بفحصها، وسيتم الاسترداد قريبًا."],
    REFUNDED: ["Your return is complete and your refund has been issued.", "تم إكمال الإرجاع واسترداد المبلغ."],
  };
  const m = msgs[status];
  if (!m) return;
  await sendEmail(
    ret.order.email,
    ar ? `تحديث طلب الإرجاع ${ret.order.number}` : `Return update for order ${ret.order.number}`,
    `<p>${ar ? "مرحبًا" : "Hi"} ${ret.order.fullName},</p><p>${m[ar ? 1 : 0]}</p>${note ? `<p><i>${note.replace(/</g, "&lt;")}</i></p>` : ""}${btn(orderUrl(ret.order.number), ar ? "عرض الطلب" : "View order")}`,
    `return_${status.toLowerCase()}`,
  );
}

export async function updateReturnStatus(fd: FormData) {
  const { user, ret } = await load(fd);
  const status = String(fd.get("status"));
  const staffNote = String(fd.get("staffNote") || "").trim();
  const allowed: Record<string, string[]> = { REQUESTED: ["APPROVED", "REJECTED"], APPROVED: ["RECEIVED", "REJECTED"], RECEIVED: ["REFUNDED"], REJECTED: ["APPROVED"], REFUNDED: [] };
  if (!allowed[ret.status]?.includes(status)) back(ret.id, { error: `Can't change a ${ret.status.toLowerCase()} return to ${status.toLowerCase()}.` });

  if (status === "RECEIVED") {
    const items = ret.order.items.map((i) => ({ orderItemId: i.id, quantity: Number(fd.get(`restock_${i.id}`) || 0) })).filter((i) => i.quantity > 0);
    if (items.length) await restock(ret.orderId, user.id, items);
    const returnedAll = ret.order.items.every((i) => (items.find((x) => x.orderItemId === i.id)?.quantity ?? 0) >= i.quantity);
    if (returnedAll) await db.order.update({ where: { id: ret.orderId }, data: { fulfillmentStatus: "RETURNED" } });
    await orderEvent(ret.orderId, "return", `Return received${items.length ? `, ${items.reduce((s, i) => s + i.quantity, 0)} item(s) restocked` : ""}.`, user.id);
  } else {
    await orderEvent(ret.orderId, "return", `Return ${status.toLowerCase()}${staffNote ? `: ${staffNote}` : ""}.`, user.id);
  }
  await db.returnRequest.update({ where: { id: ret.id }, data: { status, staffNote: staffNote || ret.staffNote } });
  await logActivity(user, "updated", "return", `Return for ${ret.order.number} → ${status}`, ret.id);
  if (fd.get("notify") === "on") await notify(ret, status, staffNote);
  back(ret.id, { msg: `Return marked as ${status.toLowerCase()}.` });
}

export async function refundReturn(fd: FormData) {
  const { user, ret } = await load(fd);
  const amount = Number(fd.get("amount") || 0);
  const err = await performRefund(ret.orderId, amount, `Return: ${ret.reason}`, [], user, true);
  if (!err) await applySellerRefund(ret.orderId, amount);
  if (err) back(ret.id, { error: err });
  await db.returnRequest.update({ where: { id: ret.id }, data: { status: "REFUNDED" } });
  await orderEvent(ret.orderId, "return", "Return refunded and closed.", user.id);
  await logActivity(user, "refunded", "return", `Refunded return for ${ret.order.number}`, ret.id);
  back(ret.id, { msg: "Refund issued and return closed." });
}

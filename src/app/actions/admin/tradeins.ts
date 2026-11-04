"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { sendEmail } from "@/lib/mailer";

export async function updateTradeIn(formData: FormData) {
  const user = await requirePermission("orders");
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  const offer = formData.get("offer") ? Number(formData.get("offer")) : null;
  const staffNote = String(formData.get("staffNote") || "") || null;
  if (!["NEW", "QUOTED", "COLLECTED", "PAID", "REJECTED"].includes(status)) return;
  const t = await db.tradeIn.update({ where: { id }, data: { status, offer, staffNote } });
  let gift = "";
  if (status === "PAID" && t.payout === "CREDIT" && (offer ?? t.estimate) > 0 && !t.staffNote?.includes("GIFT:")) {
    const code = Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, "X")).join("-");
    const value = Math.round((offer ?? t.estimate) * 1.1);
    await db.giftCard.create({ data: { code, initialValue: value, balance: value, customerEmail: t.email, note: `Trade-in ${t.model}` } });
    await db.tradeIn.update({ where: { id }, data: { staffNote: `${staffNote ?? ""} GIFT:${code}`.trim() } });
    gift = `<p>Your store credit gift card: <b>${code}</b> (AED ${value}). Use it at checkout.</p>`;
  }
  if (formData.get("notify") === "on") {
    const msg: Record<string, string> = { QUOTED: `Our offer for your ${t.model} is AED ${offer ?? t.estimate}. Reply to accept and we'll book a free collection.`, COLLECTED: `We've collected your ${t.model} and will inspect it within 1 business day.`, PAID: `Payment for your ${t.model} has been issued.`, REJECTED: `Unfortunately we can't accept your ${t.model}.${staffNote ? ` ${staffNote}` : ""}` };
    if (msg[status]) await sendEmail(t.email, `Your trade-in: ${t.model}`, `<p>Hi ${t.name},</p><p>${msg[status]}</p>${gift}`, "trade_in_update");
  }
  await logActivity(user, "updated", "trade-in", `Trade-in ${t.model} → ${status}`, id);
  revalidatePath("/admin/trade-ins");
}

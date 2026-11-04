"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { sendEmail } from "@/lib/mailer";
import { getSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/site";
import type { FormState } from "@/app/actions/auth";

const ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genCode() {
  const b = randomBytes(16);
  const s = Array.from(b, (x) => ALPH[x % ALPH.length]).join("");
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}`;
}

async function emailCard(code: string, value: number, to: string, note?: string | null, expiresAt?: Date | null) {
  const s = await getSettings();
  await sendEmail(
    to,
    `Your ${s.storeName} gift card: AED ${value}`,
    `<h2 style="margin:0 0 8px">You've received a gift card!</h2>${note ? `<p>${note}</p>` : ""}
<div style="margin:16px 0;padding:18px;border-radius:12px;background:#0b1220;color:#fff;text-align:center">
<div style="font-size:13px;opacity:.7">Gift card balance</div><div style="font-size:30px;font-weight:800">AED ${value}</div>
<div style="margin-top:8px;font-family:monospace;font-size:20px;letter-spacing:2px">${code}</div></div>
<p>Enter this code at checkout on <a href="${siteUrl()}">${siteUrl().replace(/^https?:\/\//, "")}</a>.${expiresAt ? ` Valid until ${expiresAt.toLocaleDateString("en-AE")}.` : ""}</p>`,
    "gift_card",
  );
}

export async function createGiftCard(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("products");
  const value = Number(fd.get("value"));
  if (!(value > 0) || value > 100000) return { error: "Enter a value between 1 and 100,000." };
  let code = String(fd.get("code") || "").trim().toUpperCase().replace(/\s+/g, "");
  if (code && !/^[A-Z0-9-]{8,32}$/.test(code)) return { error: "Code must be 8–32 letters, numbers or dashes." };
  if (!code) code = genCode();
  if (await db.giftCard.findUnique({ where: { code } })) return { error: "That code already exists." };
  const email = String(fd.get("customerEmail") || "").trim().toLowerCase() || null;
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid email." };
  const exp = String(fd.get("expiresAt") || "");
  const card = await db.giftCard.create({
    data: { code, initialValue: value, balance: value, customerEmail: email, note: String(fd.get("note") || "") || null, expiresAt: exp ? new Date(exp + "T23:59:59") : null },
  });
  if (email && fd.get("send") === "on") await emailCard(code, value, email, card.note, card.expiresAt);
  await logActivity(user, "created", "gift_card", `Issued gift card …${code.slice(-4)} for AED ${value}`, card.id);
  redirect(`/admin/gift-cards/${card.id}?created=1`);
}

export async function updateGiftCard(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("products");
  const id = String(fd.get("id"));
  const card = await db.giftCard.findUnique({ where: { id } });
  if (!card) return { error: "Not found." };
  const balance = Number(fd.get("balance"));
  if (!(balance >= 0)) return { error: "Balance must be 0 or more." };
  const email = String(fd.get("customerEmail") || "").trim().toLowerCase() || null;
  const exp = String(fd.get("expiresAt") || "");
  await db.giftCard.update({
    where: { id },
    data: { balance, customerEmail: email, note: String(fd.get("note") || "") || null, expiresAt: exp ? new Date(exp + "T23:59:59") : null, active: fd.get("active") === "on" },
  });
  await logActivity(user, "updated", "gift_card", `Updated gift card …${card.code.slice(-4)}${balance !== card.balance ? ` (balance ${card.balance} → ${balance})` : ""}`, id);
  revalidatePath(`/admin/gift-cards/${id}`);
  return { ok: "Gift card saved." };
}

export async function resendGiftCard(fd: FormData) {
  const user = await requirePermission("products");
  const card = await db.giftCard.findUnique({ where: { id: String(fd.get("id")) } });
  if (!card?.customerEmail) return;
  await emailCard(card.code, card.balance, card.customerEmail, card.note, card.expiresAt);
  await logActivity(user, "emailed", "gift_card", `Sent gift card …${card.code.slice(-4)} to ${card.customerEmail}`, card.id);
  revalidatePath(`/admin/gift-cards/${card.id}`);
}

export async function deleteGiftCard(fd: FormData) {
  const user = await requirePermission("products");
  const card = await db.giftCard.delete({ where: { id: String(fd.get("id")) } }).catch(() => null);
  if (card) await logActivity(user, "deleted", "gift_card", `Deleted gift card …${card.code.slice(-4)}`, card.id);
  redirect("/admin/gift-cards");
}

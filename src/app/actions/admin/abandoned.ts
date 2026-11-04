"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { sendEmail, btn } from "@/lib/mailer";
import { siteUrl } from "@/lib/site";
import { getSettings } from "@/lib/settings";
import { aed } from "@/lib/format";

type Entry = { v: string; q: number; w?: boolean };
function parseItems(s: string): Entry[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export async function sendRecoveryEmails(fd: FormData) {
  const user = await requirePermission("orders");
  const ids = fd.getAll("ids").map(String);
  if (!ids.length) redirect("/admin/abandoned?error=Select%20at%20least%20one%20checkout");
  const s = await getSettings();
  const checkouts = await db.checkout.findMany({ where: { id: { in: ids }, recoveredOrder: null, email: { not: null } } });
  for (const c of checkouts) {
    const items = parseItems(c.items);
    const variants = await db.variant.findMany({ where: { id: { in: items.map((i) => i.v) } }, include: { product: true } });
    const ar = c.locale === "ar";
    const rows = items.map((i) => {
      const v = variants.find((x) => x.id === i.v);
      return v ? `<li>${ar && v.product.nameAr ? v.product.nameAr : `${v.product.brand} ${v.product.name}`}${v.title !== "Default Title" ? ` (${v.title})` : ""} × ${i.q}: ${aed(v.price * i.q, c.locale)}</li>` : "";
    }).join("");
    const html = ar
      ? `<h2>هل نسيت شيئًا؟</h2><p>تركت هذه المنتجات في سلتك لدى ${s.storeNameAr || s.storeName}. ما زالت متوفرة لكن الكمية محدودة.</p><ul>${rows}</ul>${btn(`${siteUrl()}/cart/recover/${c.token}`, "أكمل طلبك")}`
      : `<h2>Did you forget something?</h2><p>You left these items in your cart at ${s.storeName}. They're still available, but stock is limited.</p><ul>${rows}</ul>${btn(`${siteUrl()}/cart/recover/${c.token}`, "Complete your order")}`;
    await sendEmail(c.email!, ar ? "سلتك بانتظارك" : "Your cart is waiting for you", html, "abandoned_checkout");
    await db.checkout.update({ where: { id: c.id }, data: { reminderSentAt: new Date() } });
  }
  await logActivity(user, "emailed", "checkout", `Sent ${checkouts.length} cart recovery email(s)`);
  redirect(`/admin/abandoned?msg=${encodeURIComponent(`Sent ${checkouts.length} recovery email(s).`)}`);
}

export async function deleteCheckouts(fd: FormData) {
  const user = await requirePermission("orders");
  const ids = fd.getAll("ids").map(String);
  const r = await db.checkout.deleteMany({ where: { id: { in: ids } } });
  await logActivity(user, "deleted", "checkout", `Deleted ${r.count} abandoned checkout(s)`);
  redirect(`/admin/abandoned?msg=${encodeURIComponent(`Deleted ${r.count} checkout(s).`)}`);
}

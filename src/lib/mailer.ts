import "server-only";
import { db } from "./db";
import { getSettings } from "./settings";

/**
 * Sends a transactional email via Resend when RESEND_API_KEY is set,
 * otherwise records it in EmailLog (viewable in Admin → Settings → Notifications).
 */
export async function sendEmail(to: string, subject: string, bodyHtml: string, template: string) {
  const s = await getSettings();
  const html = layout(s.storeName, bodyHtml, s.email);
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    await db.emailLog.create({ data: { to, subject, html, template, status: "LOGGED" } });
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM || `${s.storeName} <${s.email}>`, to, subject, html }),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    await db.emailLog.create({ data: { to, subject, html, template, status: "SENT" } });
  } catch (e) {
    await db.emailLog.create({ data: { to, subject, html, template, status: "FAILED", error: String(e) } });
  }
}

function layout(store: string, body: string, support: string) {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a">
<div style="background:#0b1220;color:#fff;padding:18px 24px;border-radius:12px 12px 0 0;font-size:20px;font-weight:800">${store}</div>
<div style="border:1px solid #e2e8f0;border-top:0;padding:24px;border-radius:0 0 12px 12px">${body}
<p style="color:#64748b;font-size:12px;margin-top:24px">Questions? Reply to this email or contact ${support}.</p></div></div>`;
}

export const btn = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#15803d;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700">${label}</a>`;

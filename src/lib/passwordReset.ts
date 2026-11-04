import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";
import { sendEmail, btn } from "./mailer";
import { siteUrl } from "./site";

const hash = (t: string) => createHash("sha256").update(t).digest("hex");

/** Creates a 1-hour reset token and emails the link. Silent if the user doesn't exist. */
export async function sendPasswordReset(email: string) {
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || user.disabled) return;
  const token = randomBytes(32).toString("hex");
  await db.passwordReset.create({ data: { userId: user.id, tokenHash: hash(token), expiresAt: new Date(Date.now() + 3600_000) } });
  const ar = user.locale === "ar";
  await sendEmail(
    user.email,
    ar ? "إعادة تعيين كلمة المرور" : "Reset your password",
    `<p>${ar ? "اضغط الزر أدناه لتعيين كلمة مرور جديدة. ينتهي الرابط خلال ساعة." : "Click below to choose a new password. The link expires in 1 hour."}</p>${btn(`${siteUrl()}/reset-password/${token}`, ar ? "تعيين كلمة المرور" : "Reset password")}`,
    "password_reset",
  );
}

export async function consumeResetToken(token: string) {
  const row = await db.passwordReset.findUnique({ where: { tokenHash: hash(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) return null;
  return row;
}

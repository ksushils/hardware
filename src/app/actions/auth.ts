"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { getI18n } from "@/lib/i18n";
import { isStaff } from "@/lib/permissions";
import { consumeResetToken, sendPasswordReset } from "@/lib/passwordReset";
import { limitByIp } from "@/lib/rateLimit";

const tooMany = (ar: boolean) => (ar ? "محاولات كثيرة. يرجى الانتظار قليلًا ثم المحاولة مرة أخرى." : "Too many attempts. Please wait a few minutes and try again.");

export type FormState = { error?: string; ok?: string } | undefined;

function safeNext(n: FormDataEntryValue | null, fallback = "/account") {
  const s = String(n || fallback);
  return s.startsWith("/") && !s.startsWith("//") ? s : fallback;
}

export async function register(_: FormState, formData: FormData): Promise<FormState> {
  const { t, locale } = await getI18n();
  if (!(await limitByIp("register", 8, 3600))) return { error: tooMany(locale === "ar") };
  const e = t.auth.errors;
  const schema = z.object({
    name: z.string().trim().min(2, e.name),
    email: z.string().trim().toLowerCase().email(e.email),
    phone: z.string().trim().regex(/^(\+971|0)?5\d{8}$/, e.phone).or(z.literal("")),
    password: z.string().min(8, e.password),
  });
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, phone, password } = parsed.data;
  if (await db.user.findUnique({ where: { email } })) return { error: e.exists };
  const marketing = formData.get("marketing") === "on";
  const user = await db.user.create({ data: { name, email, phone: phone || null, password: await hashPassword(password), acceptsMarketing: marketing, locale } });
  if (marketing) await db.subscriber.upsert({ where: { email }, update: {}, create: { email, locale, source: "signup" } });
  await db.order.updateMany({ where: { email, userId: null }, data: { userId: user.id } });
  await createSession(user.id);
  redirect(safeNext(formData.get("next")));
}

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const { t, locale } = await getI18n();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  // brute-force protection: per IP and per account
  if (!(await limitByIp("login", 10, 900, email))) return { error: tooMany(locale === "ar") };
  const password = String(formData.get("password") || "");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.disabled || !(await verifyPassword(password, user.password))) return { error: t.auth.errors.invalid };
  await createSession(user.id);
  redirect(isStaff(user) && !formData.get("next") ? "/admin" : safeNext(formData.get("next")));
}

export async function logout() {
  await destroySession();
  redirect("/");
}

export async function forgotPassword(_: FormState, formData: FormData): Promise<FormState> {
  const { t, locale } = await getI18n();
  const email = String(formData.get("email") || "");
  if (!(await limitByIp("forgot", 5, 3600, email))) return { error: tooMany(locale === "ar") };
  if (email.includes("@")) await sendPasswordReset(email);
  return { ok: t.auth.linkSent };
}

export async function resetPassword(_: FormState, formData: FormData): Promise<FormState> {
  const { t, locale } = await getI18n();
  if (!(await limitByIp("reset", 10, 3600))) return { error: tooMany(locale === "ar") };
  const token = String(formData.get("token") || "");
  const password = String(formData.get("password") || "");
  if (password.length < 8) return { error: t.auth.errors.password };
  const row = await consumeResetToken(token);
  if (!row) return { error: t.auth.resetInvalid };
  await db.$transaction([
    db.user.update({ where: { id: row.userId }, data: { password: await hashPassword(password) } }),
    db.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
  ]);
  await createSession(row.userId);
  redirect("/account");
}

export async function setLocale(formData: FormData) {
  const { cookies } = await import("next/headers");
  const l = formData.get("locale") === "ar" ? "ar" : "en";
  (await cookies()).set("locale", l, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}

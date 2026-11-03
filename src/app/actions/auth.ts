"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";

export type FormState = { error?: string; ok?: string } | undefined;

function safeNext(n: FormDataEntryValue | null) {
  const s = String(n || "/account");
  return s.startsWith("/") && !s.startsWith("//") ? s : "/account";
}

const registerSchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z.string().trim().regex(/^(\+971|0)?5\d{8}$/, "Enter a valid UAE mobile number, e.g. 0501234567").or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function register(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, phone, password } = parsed.data;
  if (await db.user.findUnique({ where: { email } })) return { error: "An account with this email already exists." };
  const user = await db.user.create({
    data: { name, email, phone: phone || null, password: await hashPassword(password) },
  });
  // Attach any earlier guest orders placed with this email
  await db.order.updateMany({ where: { email, userId: null }, data: { userId: user.id } });
  await createSession(user.id);
  redirect(safeNext(formData.get("next")));
}

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.password))) return { error: "Invalid email or password." };
  await createSession(user.id);
  redirect(user.role === "ADMIN" && !formData.get("next") ? "/admin" : safeNext(formData.get("next")));
}

export async function logout() {
  await destroySession();
  redirect("/");
}

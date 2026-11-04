"use server";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { hashPassword, requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { PERMISSIONS, type Permission } from "@/lib/permissions";
import { sendPasswordReset } from "@/lib/passwordReset";

type FS = { error?: string; ok?: string } | undefined;
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const perms = (fd: FormData) => fd.getAll("permissions").map(String).filter((p): p is Permission => p in PERMISSIONS).join(",");

async function adminCount() {
  return db.user.count({ where: { role: "ADMIN", disabled: false } });
}

export async function addStaff(_: FS, fd: FormData): Promise<FS> {
  const me = await requirePermission("staff");
  const email = s(fd, "email").toLowerCase();
  const name = s(fd, "name");
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return { error: "Name and a valid email are required." };
  const role = s(fd, "role") === "ADMIN" && me.role === "ADMIN" ? "ADMIN" : "STAFF";
  const password = s(fd, "password");
  if (password && password.length < 8) return { error: "Password must be at least 8 characters." };
  const existing = await db.user.findUnique({ where: { email } });
  if (existing && existing.role !== "CUSTOMER") return { error: "This person is already a staff member." };
  const permissions = perms(fd);
  if (existing) {
    await db.user.update({ where: { id: existing.id }, data: { role, permissions, disabled: false, ...(password ? { password: await hashPassword(password) } : {}) } });
  } else {
    await db.user.create({ data: { email, name, role, permissions, password: await hashPassword(password || randomBytes(24).toString("hex")) } });
  }
  if (!password || fd.get("sendInvite") === "on") await sendPasswordReset(email);
  await logActivity(me, "created", "staff", `Added ${role === "ADMIN" ? "admin" : "staff"} ${email}`);
  revalidatePath("/admin/settings/staff");
  return { ok: `${email} added${!password ? " — a set-password email was sent" : ""}.` };
}

export async function updateStaff(_: FS, fd: FormData): Promise<FS> {
  const me = await requirePermission("staff");
  const id = s(fd, "id");
  const u = await db.user.findUnique({ where: { id } });
  if (!u || u.role === "CUSTOMER") return { error: "Staff member not found." };
  const role = s(fd, "role") === "ADMIN" ? "ADMIN" : "STAFF";
  if (role === "ADMIN" && me.role !== "ADMIN") return { error: "Only the store owner/admin can grant admin access." };
  if (u.role === "ADMIN" && role !== "ADMIN") {
    if (u.id === me.id) return { error: "You can't demote yourself." };
    if ((await adminCount()) <= 1) return { error: "There must be at least one admin." };
  }
  await db.user.update({ where: { id }, data: { role, permissions: perms(fd) } });
  await logActivity(me, "updated", "staff", `Updated permissions for ${u.email}`, id);
  revalidatePath("/admin/settings/staff");
  return { ok: "Permissions updated." };
}

export async function toggleStaffDisabled(fd: FormData) {
  const me = await requirePermission("staff");
  const u = await db.user.findUnique({ where: { id: s(fd, "id") } });
  if (!u || u.role === "CUSTOMER" || u.id === me.id) return;
  if (!u.disabled && u.role === "ADMIN" && (await adminCount()) <= 1) return;
  if (u.role === "ADMIN" && me.role !== "ADMIN") return;
  await db.user.update({ where: { id: u.id }, data: { disabled: !u.disabled } });
  await logActivity(me, "updated", "staff", `${u.disabled ? "Enabled" : "Disabled"} ${u.email}`, u.id);
  revalidatePath("/admin/settings/staff");
}

export async function removeStaff(fd: FormData) {
  const me = await requirePermission("staff");
  const u = await db.user.findUnique({ where: { id: s(fd, "id") } });
  if (!u || u.role === "CUSTOMER" || u.id === me.id) return;
  if (u.role === "ADMIN" && (me.role !== "ADMIN" || (await adminCount()) <= 1)) return;
  await db.user.update({ where: { id: u.id }, data: { role: "CUSTOMER", permissions: "" } });
  await logActivity(me, "deleted", "staff", `Removed staff access for ${u.email}`, u.id);
  revalidatePath("/admin/settings/staff");
}

export async function resendInvite(fd: FormData) {
  const me = await requirePermission("staff");
  const u = await db.user.findUnique({ where: { id: s(fd, "id") } });
  if (!u) return;
  await sendPasswordReset(u.email);
  await logActivity(me, "updated", "staff", `Sent password reset to ${u.email}`, u.id);
}

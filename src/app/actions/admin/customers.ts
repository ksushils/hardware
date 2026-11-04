"use server";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { hashPassword, requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { sendPasswordReset } from "@/lib/passwordReset";
import { csv } from "@/lib/format";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const back = (id: string, p: Record<string, string>): never => redirect(`/admin/customers/${id}?${new URLSearchParams(p)}`);

export async function createCustomer(fd: FormData) {
  const user = await requirePermission("customers");
  const name = s(fd, "name");
  const email = s(fd, "email").toLowerCase();
  if (name.length < 2) redirect("/admin/customers/new?error=Enter%20the%20customer's%20name");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect("/admin/customers/new?error=Enter%20a%20valid%20email");
  if (await db.user.findUnique({ where: { email } })) redirect("/admin/customers/new?error=A%20customer%20with%20this%20email%20already%20exists");
  const c = await db.user.create({
    data: {
      name, email, phone: s(fd, "phone") || null, tags: csv(s(fd, "tags")).join(","), note: s(fd, "note") || null,
      acceptsMarketing: fd.get("acceptsMarketing") === "on", locale: s(fd, "locale") === "ar" ? "ar" : "en",
      password: await hashPassword(randomBytes(24).toString("hex")),
    },
  });
  await db.order.updateMany({ where: { email, userId: null }, data: { userId: c.id } });
  if (fd.get("invite") === "on") await sendPasswordReset(email);
  await logActivity(user, "created", "customer", `Created customer ${email}`, c.id);
  back(c.id, { msg: fd.get("invite") === "on" ? "Customer created and invite sent." : "Customer created." });
}

export async function updateCustomer(fd: FormData) {
  const user = await requirePermission("customers");
  const id = s(fd, "id");
  const name = s(fd, "name");
  if (name.length < 2) back(id, { error: "Name is too short." });
  await db.user.update({
    where: { id },
    data: { name, phone: s(fd, "phone") || null, acceptsMarketing: fd.get("acceptsMarketing") === "on", locale: s(fd, "locale") === "ar" ? "ar" : "en" },
  });
  await logActivity(user, "updated", "customer", `Updated customer ${name}`, id);
  back(id, { msg: "Customer updated." });
}

export async function updateCustomerNotes(fd: FormData) {
  const user = await requirePermission("customers");
  const id = s(fd, "id");
  await db.user.update({ where: { id }, data: { note: s(fd, "note") || null, tags: csv(s(fd, "tags")).join(",") } });
  await logActivity(user, "updated", "customer", "Updated customer notes/tags", id);
  back(id, { msg: "Saved." });
}

export async function toggleCustomerDisabled(fd: FormData) {
  const user = await requirePermission("customers");
  const id = s(fd, "id");
  const c = await db.user.findUniqueOrThrow({ where: { id } });
  if (c.role !== "CUSTOMER") back(id, { error: "Staff accounts are managed in Settings → Staff." });
  await db.user.update({ where: { id }, data: { disabled: !c.disabled } });
  await logActivity(user, c.disabled ? "enabled" : "disabled", "customer", `${c.disabled ? "Enabled" : "Disabled"} account ${c.email}`, id);
  back(id, { msg: c.disabled ? "Account enabled." : "Account disabled. The customer can no longer sign in." });
}

export async function sendCustomerReset(fd: FormData) {
  const user = await requirePermission("customers");
  const id = s(fd, "id");
  const c = await db.user.findUniqueOrThrow({ where: { id } });
  await sendPasswordReset(c.email);
  await logActivity(user, "emailed", "customer", `Sent password reset to ${c.email}`, id);
  back(id, { msg: `Password reset email sent to ${c.email}.` });
}

export async function deleteSubscriber(fd: FormData) {
  const user = await requirePermission("customers");
  const ids = fd.getAll("ids").map(String);
  const r = await db.subscriber.deleteMany({ where: { id: { in: ids } } });
  await logActivity(user, "deleted", "subscriber", `Deleted ${r.count} subscriber(s)`);
  redirect(`/admin/subscribers?msg=${encodeURIComponent(`Deleted ${r.count} subscriber(s).`)}`);
}

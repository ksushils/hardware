"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { addMessage, assignCase, decideCase, escalateCase, proposeResolution, reopenCase, setStatus, updateRepairStatus, type Actor } from "@/lib/cases";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const back = (number: string, p: Record<string, string>): never => {
  revalidatePath(`/admin/cases/${number}`);
  revalidatePath("/admin/cases");
  revalidatePath(`/account/cases/${number}`);
  revalidatePath(`/cases/${number}`);
  revalidatePath(`/seller/cases/${number}`);
  return redirect(`/admin/cases/${number}?${new URLSearchParams(p)}`);
};

async function load(fd: FormData) {
  const user = await requirePermission("orders");
  const number = s(fd, "number");
  const c = await db.supportCase.findUnique({ where: { number } });
  if (!c) redirect("/admin/cases?error=Case%20not%20found");
  const actor: Actor = { role: "STAFF", id: user.id, name: user.name };
  return { user, c, actor, number };
}
const done = (number: string, err: string | null, msg: string) => back(number, err ? { error: err } : { msg });

export async function staffMessage(fd: FormData) {
  const { c, actor, number } = await load(fd);
  const files = fd.getAll("files").filter((f): f is File => typeof f !== "string" && f.size > 0);
  const internal = fd.get("internal") === "on";
  return done(number, await addMessage(c.id, actor, s(fd, "body"), { internal, files }), internal ? "Private note added. Only staff can see it." : "Message sent.");
}

export async function staffAssign(fd: FormData) {
  const { c, actor, number, user } = await load(fd);
  const raw = s(fd, "assignee");
  let staffId: string | null = null;
  if (raw === "me") staffId = user.id;
  else if (raw) {
    const target = await db.user.findUnique({ where: { id: raw }, select: { id: true, role: true, permissions: true, disabled: true } });
    if (!target || target.disabled || !hasPermission(target, "orders")) return back(number, { error: "That person can't handle cases." });
    staffId = target.id;
  }
  await assignCase(c.id, staffId, actor);
  return back(number, { msg: staffId ? "Case assigned." : "Case unassigned." });
}

/** Ask the buyer or the seller for more information (sets AWAITING_BUYER / AWAITING_SELLER and posts the question). */
export async function staffRequestInfo(fd: FormData) {
  const { c, actor, number } = await load(fd);
  const from = s(fd, "from");
  const body = s(fd, "body");
  if (body.length < 5) return back(number, { error: "Write the question you want answered." });
  if (from === "seller" && !c.sellerId) return back(number, { error: "This case has no seller to ask." });
  const err = await addMessage(c.id, actor, body);
  if (err) return back(number, { error: err });
  return done(number, await setStatus(c.id, from === "seller" ? "AWAITING_SELLER" : "AWAITING_BUYER", actor, { notify: false }), `Question sent to the ${from}.`);
}

export async function staffSetStatus(fd: FormData) {
  const { c, actor, number } = await load(fd);
  const to = s(fd, "status");
  if (to === "REOPEN") return done(number, await reopenCase(c.id, actor, s(fd, "note")), "Case reopened.");
  if (to === "ESCALATED") return done(number, await escalateCase(c.id, actor, s(fd, "note") || "Escalated by staff"), "Case escalated.");
  return done(number, await setStatus(c.id, to, actor, { note: s(fd, "note") }), `Status set to ${to.replace(/_/g, " ").toLowerCase()}.`);
}

export async function staffPropose(fd: FormData) {
  const { c, actor, number } = await load(fd);
  return done(number, await proposeResolution(c.id, actor, { type: s(fd, "type"), amount: Number(fd.get("amount")) || undefined, note: s(fd, "note") }), "Resolution proposed to the buyer.");
}

export async function staffDecide(fd: FormData) {
  const { user, c, number } = await load(fd);
  const err = await decideCase(c.id, { id: user.id, name: user.name }, { decision: s(fd, "decision"), amount: Number(fd.get("amount")) || undefined, note: s(fd, "note") });
  return done(number, err, "Decision recorded and the people involved have been notified.");
}

export async function staffRepair(fd: FormData) {
  const { c, actor, number } = await load(fd);
  return done(number, await updateRepairStatus(c.id, actor, s(fd, "status")), "Repair status updated.");
}

"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { canViewOrder } from "@/lib/orders";
import { requireSeller } from "@/lib/sellerAuth";
import { limitByIp } from "@/lib/rateLimit";
import {
  addMessage, caseAccessKey, createCase, escalateCase, getCaseForBuyer, getCaseForSeller, proposeResolution, reopenCase, respondToProposal, setStatus, updateRepairStatus,
  type Actor,
} from "@/lib/cases";

type FormState = { error?: string; ok?: string } | undefined;
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const filesOf = (fd: FormData) => fd.getAll("files").filter((f): f is File => typeof f !== "string" && f.size > 0);
const refresh = (number: string) => {
  revalidatePath(`/account/cases/${number}`);
  revalidatePath(`/cases/${number}`);
  revalidatePath(`/seller/cases/${number}`);
  revalidatePath(`/admin/cases/${number}`);
  revalidatePath("/account/cases");
  revalidatePath("/seller/cases");
  revalidatePath("/admin/cases");
};
const TOO_MANY = "You're doing that a bit too quickly. Please wait a few minutes and try again.";

/* ───────────────────────── buyer ───────────────────────── */
export async function openCase(_: FormState, fd: FormData): Promise<FormState> {
  if (!(await limitByIp("case-create", 10, 3600))) return { error: TOO_MANY };
  const user = await getUser();
  const number = s(fd, "order");
  let order = null;
  if (number) {
    order = await db.order.findUnique({ where: { number }, include: { items: true } });
    if (!order || order.status === "DRAFT" || !(await canViewOrder(order, s(fd, "k")))) return { error: "We couldn't find that order. Please sign in or use the link from your order email." };
  } else if (!user) return { error: "Please sign in to open a case." };
  const res = await createCase({
    user: user ? { id: user.id, name: user.name, email: user.email } : null,
    order, orderItemId: s(fd, "item") || null, quantity: Number(fd.get("quantity")) || null,
    type: s(fd, "type"), reason: s(fd, "reason"), requestedResolution: s(fd, "requested"), files: filesOf(fd),
  });
  if ("error" in res) return { error: res.error };
  refresh(res.number);
  redirect(user ? `/account/cases/${res.number}` : `/cases/${res.number}?k=${caseAccessKey(res.number)}`);
}

async function buyerCase(fd: FormData) {
  const user = await getUser();
  const number = s(fd, "number");
  const c = await getCaseForBuyer(number, user, s(fd, "k"));
  const actor: Actor | null = c ? { role: "BUYER", id: user?.id ?? null, name: user?.name ?? "Customer" } : null;
  return { c, actor, number };
}

export async function buyerMessage(_: FormState, fd: FormData): Promise<FormState> {
  if (!(await limitByIp("case-message", 30, 3600))) return { error: TOO_MANY };
  const { c, actor, number } = await buyerCase(fd);
  if (!c || !actor) return { error: "Case not found." };
  const err = await addMessage(c.id, actor, s(fd, "body"), { files: filesOf(fd) });
  if (err) return { error: err };
  refresh(number);
  return { ok: "Message sent." };
}

export async function buyerRespond(_: FormState, fd: FormData): Promise<FormState> {
  const { c, actor, number } = await buyerCase(fd);
  if (!c || !actor) return { error: "Case not found." };
  const err = await respondToProposal(c.id, actor, s(fd, "accept") === "1", s(fd, "comment"));
  if (err) return { error: err };
  refresh(number);
  return { ok: "Thanks, we've recorded your response." };
}

export async function buyerEscalate(_: FormState, fd: FormData): Promise<FormState> {
  const { c, actor, number } = await buyerCase(fd);
  if (!c || !actor) return { error: "Case not found." };
  const err = await escalateCase(c.id, actor, s(fd, "reason"));
  if (err) return { error: err };
  refresh(number);
  return { ok: "Karat support has been asked to step in." };
}

export async function buyerReopen(_: FormState, fd: FormData): Promise<FormState> {
  const { c, actor, number } = await buyerCase(fd);
  if (!c || !actor) return { error: "Case not found." };
  const err = await reopenCase(c.id, actor, s(fd, "reason"));
  if (err) return { error: err };
  refresh(number);
  return { ok: "Your case has been reopened." };
}

export async function buyerWithdraw(_: FormState, fd: FormData): Promise<FormState> {
  const { c, actor, number } = await buyerCase(fd);
  if (!c || !actor) return { error: "Case not found." };
  if (["RESOLVED", "CLOSED"].includes(c.status)) return { error: "This case is already closed." };
  await db.caseMessage.create({ data: { caseId: c.id, authorRole: "BUYER", authorId: actor.id ?? null, authorName: actor.name, body: "I've withdrawn this case.", internal: false } });
  const err = await setStatus(c.id, "CLOSED", actor);
  if (err) return { error: err };
  refresh(number);
  return { ok: "Case withdrawn." };
}

/* ───────────────────────── seller (always scoped by the signed-in seller) ───────────────────────── */
async function sellerCase(fd: FormData) {
  const { user, seller } = await requireSeller();
  const number = s(fd, "number");
  const c = await getCaseForSeller(number, seller.id);
  const actor: Actor = { role: "SELLER", id: user.id, name: seller.shopName };
  return { c, actor, number };
}

export async function sellerMessage(_: FormState, fd: FormData): Promise<FormState> {
  if (!(await limitByIp("case-message", 30, 3600))) return { error: TOO_MANY };
  const { c, actor, number } = await sellerCase(fd);
  if (!c) return { error: "Case not found." };
  const err = await addMessage(c.id, actor, s(fd, "body"), { files: filesOf(fd) });
  if (err) return { error: err };
  refresh(number);
  return { ok: "Reply sent to the buyer." };
}

export async function sellerPropose(_: FormState, fd: FormData): Promise<FormState> {
  const { c, actor, number } = await sellerCase(fd);
  if (!c) return { error: "Case not found." };
  const err = await proposeResolution(c.id, actor, { type: s(fd, "type"), amount: Number(fd.get("amount")) || undefined, note: s(fd, "note") });
  if (err) return { error: err };
  refresh(number);
  return { ok: "Proposal sent. The buyer can accept or decline it; refunds are carried out by Karat once agreed." };
}

export async function sellerRepair(_: FormState, fd: FormData): Promise<FormState> {
  const { c, actor, number } = await sellerCase(fd);
  if (!c) return { error: "Case not found." };
  if (c.type !== "WARRANTY" && !["REPAIR", "REPLACEMENT"].includes(c.decision ?? "")) return { error: "Repair tracking is only for warranty, repair and replacement cases." };
  const err = await updateRepairStatus(c.id, actor, s(fd, "status"));
  if (err) return { error: err };
  refresh(number);
  return { ok: "Repair status updated. The buyer can see it." };
}

export async function sellerEscalate(_: FormState, fd: FormData): Promise<FormState> {
  const { c, actor, number } = await sellerCase(fd);
  if (!c) return { error: "Case not found." };
  const err = await escalateCase(c.id, actor, s(fd, "reason"));
  if (err) return { error: err };
  refresh(number);
  return { ok: "Karat support has been asked to step in." };
}

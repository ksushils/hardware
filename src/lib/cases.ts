import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";
import type { Order, OrderItem } from "@prisma/client";
import { db } from "./db";
import { getSettings } from "./settings";
import { sendEmail, btn } from "./mailer";
import { siteUrl } from "./site";
import { logActivity, orderEvent } from "./activity";
import { PRIVATE_DIR, savePrivateFile, signFileUrl } from "./privateStorage";
import { performRefund } from "@/components/admin/sales/refund";
import { applySellerRefund } from "./marketplace";
import {
  ACTIVE_STATUSES, CASE_TYPES, DECISIONS, PROPOSALS, REPAIR_STATUSES, STAFF_ONLY_TYPES, NO_ORDER_TYPES, parseProposal, resolutionLabel, statusLabel, typeLabel,
  type Locale, type Proposal, type Snapshot,
} from "./caseLabels";

/* ───────────────────────── SLA configuration ───────────────────────── */
/** Working days for SLA maths (JS getDay(): 0=Sun … 6=Sat). UAE work week: Mon–Fri. */
export const WORKING_DAYS = [1, 2, 3, 4, 5];
export const SELLER_RESPONSE_DAYS = 2; // seller must respond within 2 working days
export const ESCALATION_GRACE_DAYS = 2; // …then Karat steps in 2 working days after the deadline
export const REOPEN_WINDOW_DAYS = 14;
export const MAX_ATTACHMENTS = 5;

export function addWorkingDays(from: Date, n: number, days: number[] = WORKING_DAYS) {
  const d = new Date(from);
  let left = n;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (days.includes(d.getDay())) left--;
  }
  return d;
}
const dueFrom = (now = new Date()) => {
  const sellerDueAt = addWorkingDays(now, SELLER_RESPONSE_DAYS);
  return { sellerDueAt, escalateAt: addWorkingDays(sellerDueAt, ESCALATION_GRACE_DAYS) };
};

/* ───────────────────────── identifiers & access keys ───────────────────────── */
export function newCaseNumber() {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `CS-${ymd}-${randomBytes(4).toString("hex").slice(0, 5).toUpperCase()}`;
}
const secret = () => process.env.AUTH_SECRET || "dev-secret-change-me-please-0123456789";
/** Signed per-case key so emailed links work for guest buyers on any device (same idea as order keys). */
export function caseAccessKey(number: string) {
  return createHmac("sha256", secret()).update(`case:${number}`).digest("hex").slice(0, 24);
}
export function verifyCaseKey(number: string, key: string | null | undefined) {
  if (!key) return false;
  const a = Buffer.from(caseAccessKey(number)), b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}
export const buyerCaseUrl = (number: string) => `${siteUrl()}/cases/${number}?k=${caseAccessKey(number)}`;
export const sellerCaseUrl = (number: string) => `${siteUrl()}/seller/cases/${number}`;
export const adminCaseUrl = (number: string) => `${siteUrl()}/admin/cases/${number}`;

/* ───────────────────────── policy snapshot ───────────────────────── */
function parseJson<T>(s: string | null | undefined): T | null {
  try { return s ? (JSON.parse(s) as T) : null; } catch { return null; }
}

/** Copies the terms the buyer agreed to at checkout (OrderItem snapshots). Older orders fall back to store defaults. */
export async function buildPolicySnapshot(order: Order, item: OrderItem | null): Promise<Snapshot> {
  const s = await getSettings();
  const deliveredAt = order.deliveredAt ?? (order.fulfillmentStatus === "DELIVERED" ? order.updatedAt : null);
  const base: Snapshot = { orderNumber: order.number, deliveredAt: deliveredAt?.toISOString() ?? null, orderedAt: order.createdAt.toISOString() };
  if (!item) return { ...base, source: "order" };
  const warranty = parseJson<Snapshot["warranty"]>(item.warrantySnapshot);
  const returns = parseJson<Snapshot["returns"]>(item.returnSnapshot);
  return {
    ...base,
    source: warranty && returns ? "checkout-snapshot" : "settings-fallback",
    sellerId: item.sellerId ?? null,
    sellerName: item.sellerName ?? s.storeName,
    item: { name: item.name, variantTitle: item.variantTitle, sku: item.sku, price: item.price, warrantyPrice: item.warrantyPrice, quantity: item.quantity },
    condition: parseJson<Record<string, unknown>>(item.conditionSnapshot),
    warranty: warranty ?? { provider: item.sellerId ? "SELLER" : "KARAT", months: s.warranty.months, terms: null },
    returns: returns ?? { days: s.returnsDays, terms: null },
  };
}

/* ───────────────────────── attachments (private storage) ───────────────────────── */
async function discardFiles(ids: string[]) {
  if (!ids.length) return;
  const rows = await db.privateFile.findMany({ where: { id: { in: ids } } });
  for (const r of rows) await unlink(path.join(PRIVATE_DIR(), r.storageKey)).catch(() => null);
  await db.privateFile.deleteMany({ where: { id: { in: ids } } });
}

/** Saves evidence files as PRIVATE files owned by the case. All-or-nothing. */
export async function saveAttachments(files: File[], caseId: string, uploadedById?: string | null): Promise<{ ids: string[]; error?: string }> {
  const real = files.filter((f) => f && typeof f !== "string" && f.size > 0);
  if (real.length > MAX_ATTACHMENTS) return { ids: [], error: `You can attach up to ${MAX_ATTACHMENTS} files at a time.` };
  const saved: string[] = [];
  try {
    for (const f of real) saved.push((await savePrivateFile(f, { ownerType: "CASE", ownerId: caseId, uploadedById: uploadedById ?? null })).id);
  } catch (e) {
    await discardFiles(saved);
    return { ids: [], error: e instanceof Error ? e.message : "Could not save the attachment" };
  }
  return { ids: saved };
}

/** Attachment links (signed, short-lived, served by /api/files/[id]). Only files owned by this case are returned. */
export async function attachmentLinks(caseId: string, raw: string) {
  let ids: string[] = [];
  try { ids = JSON.parse(raw); } catch { /* */ }
  if (!Array.isArray(ids) || !ids.length) return [];
  const rows = await db.privateFile.findMany({ where: { id: { in: ids.map(String) }, ownerType: "CASE", ownerId: caseId } });
  return rows.map((r) => ({ id: r.id, filename: r.filename, mime: r.mime, size: r.size, href: signFileUrl(r.id, 900) }));
}

/* ───────────────────────── status transitions ───────────────────────── */
const T: Record<string, string[]> = {
  OPEN: ["AWAITING_SELLER", "AWAITING_BUYER", "IN_REVIEW", "PROPOSED", "ESCALATED", "RESOLVED", "CLOSED"],
  AWAITING_SELLER: ["OPEN", "AWAITING_BUYER", "IN_REVIEW", "PROPOSED", "ESCALATED", "RESOLVED", "CLOSED"],
  AWAITING_BUYER: ["OPEN", "AWAITING_SELLER", "IN_REVIEW", "PROPOSED", "ESCALATED", "RESOLVED", "CLOSED"],
  IN_REVIEW: ["OPEN", "AWAITING_SELLER", "AWAITING_BUYER", "PROPOSED", "ESCALATED", "RESOLVED", "CLOSED"],
  PROPOSED: ["OPEN", "AWAITING_SELLER", "AWAITING_BUYER", "IN_REVIEW", "ESCALATED", "RESOLVED", "CLOSED"],
  ESCALATED: ["AWAITING_SELLER", "AWAITING_BUYER", "IN_REVIEW", "PROPOSED", "RESOLVED", "CLOSED"],
  RESOLVED: ["OPEN", "IN_REVIEW", "CLOSED"], // reopen / close
  CLOSED: ["IN_REVIEW"], // reopen (buyer only inside the reopen window)
};
export const canTransition = (from: string, to: string) => !!T[from]?.includes(to);
const isFinal = (s: string) => s === "RESOLVED" || s === "CLOSED";

export type Actor = { role: "BUYER" | "SELLER" | "STAFF" | "SYSTEM"; id?: string | null; name: string };
const SYSTEM: Actor = { role: "SYSTEM", name: "System" };

/* ───────────────────────── emails ───────────────────────── */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function ctxFor(caseId: string) {
  const c = await db.supportCase.findUniqueOrThrow({
    where: { id: caseId },
    include: { order: { select: { number: true, locale: true, fullName: true } }, seller: { select: { email: true, shopName: true } }, user: { select: { locale: true, name: true } } },
  });
  const locale: Locale = (c.order?.locale ?? c.user?.locale) === "ar" ? "ar" : "en";
  return { c, locale };
}

type MailKind = "opened" | "message" | "status" | "escalated" | "proposal" | "response" | "decision" | "reminder";
async function notify(caseId: string, kind: MailKind, opts: { to: ("buyer" | "seller" | "staff")[]; note?: string; actorName?: string } ) {
  try {
    const { c, locale } = await ctxFor(caseId);
    const s = await getSettings();
    const ar = locale === "ar";
    const type = typeLabel(c.type, locale), typeEn = typeLabel(c.type, "en");
    const note = opts.note ? `<blockquote style="border-inline-start:3px solid #cbd5e1;margin:12px 0;padding:4px 12px;color:#334155">${esc(opts.note).replace(/\n/g, "<br>")}</blockquote>` : "";
    const status = (l: Locale, a: "buyer" | "seller" | "staff") => statusLabel(c.status, l, a);
    for (const who of opts.to) {
      if (who === "buyer") {
        const subj: Record<MailKind, [string, string]> = {
          opened: [`We received your case ${c.number}`, `استلمنا طلب الدعم ${c.number}`],
          message: [`New message on case ${c.number}`, `رسالة جديدة بخصوص الطلب ${c.number}`],
          status: [`Case ${c.number}: ${status("en", "buyer")}`, `الطلب ${c.number}: ${status("ar", "buyer")}`],
          escalated: [`Case ${c.number} was escalated to Karat support`, `تم تصعيد الطلب ${c.number} إلى فريق الدعم`],
          proposal: [`A resolution was proposed for case ${c.number}`, `تم اقتراح حل للطلب ${c.number}`],
          response: [`Update on case ${c.number}`, `تحديث على الطلب ${c.number}`],
          decision: [`Decision on case ${c.number}`, `القرار بشأن الطلب ${c.number}`],
          reminder: [`Case ${c.number}`, `الطلب ${c.number}`],
        };
        const intro: Record<MailKind, [string, string]> = {
          opened: ["Thanks for getting in touch. We've sent your case to the seller and Karat support is monitoring it. You can follow it and reply below.", "شكرًا لتواصلك. أرسلنا طلبك إلى البائع وفريق الدعم يتابعه. يمكنك المتابعة والرد من الرابط أدناه."],
          message: [`${opts.actorName ?? "Someone"} replied on your case.`, `${opts.actorName ?? "أحدهم"} ردّ على طلبك.`],
          status: [`Your case is now: ${status("en", "buyer")}.`, `حالة طلبك الآن: ${status("ar", "buyer")}.`],
          escalated: ["Your case has been escalated to Karat support, who will review it directly.", "تم تصعيد طلبك إلى فريق دعم Karat وسيراجعه مباشرة."],
          proposal: ["A resolution has been proposed. Please review it and accept or decline.", "تم اقتراح حل. يرجى مراجعته وقبوله أو رفضه."],
          response: ["There's an update on your case.", "هناك تحديث على طلبك."],
          decision: ["We've reached a decision on your case. The full explanation is below.", "توصلنا إلى قرار بشأن طلبك. التفاصيل أدناه."],
          reminder: ["", ""],
        };
        await sendEmail(c.email, subj[kind][ar ? 1 : 0], `<p>${ar ? "مرحبًا" : "Hi"} ${esc(c.order?.fullName ?? c.user?.name ?? "")},</p><p>${intro[kind][ar ? 1 : 0]}</p><p><b>${type}</b> · ${esc(c.reason.slice(0, 160))}</p>${note}${btn(buyerCaseUrl(c.number), ar ? "عرض الطلب" : "View case")}`, `case_${kind}_buyer`);
      }
      if (who === "seller" && c.seller) {
        const subj: Record<MailKind, string> = {
          opened: `Action needed: new buyer case ${c.number}`, message: `New message on case ${c.number}`, status: `Case ${c.number}: ${status("en", "seller")}`,
          escalated: `Case ${c.number} was escalated to Karat`, proposal: `Resolution proposed on case ${c.number}`, response: `The buyer responded on case ${c.number}`,
          decision: `Decision on case ${c.number}`, reminder: `Reminder: respond to case ${c.number}`,
        };
        const due = c.sellerDueAt && c.status === "AWAITING_SELLER" ? ` Please respond by <b>${c.sellerDueAt.toLocaleString("en-AE", { dateStyle: "medium", timeStyle: "short" })}</b>.` : "";
        await sendEmail(c.seller.email, subj[kind], `<p>Hi ${esc(c.seller.shopName)},</p><p>Case <b>${c.number}</b> (${typeEn}): ${esc(c.reason.slice(0, 200))}.${due}</p>${note}${btn(sellerCaseUrl(c.number), "Open case")}`, `case_${kind}_seller`);
      }
      if (who === "staff" && s.notifications.staffEmail) {
        await sendEmail(s.notifications.staffEmail, `[Case ${c.number}] ${kind === "escalated" ? "ESCALATED: " : ""}${typeEn}`, `<p>Case <b>${c.number}</b> (${typeEn}), status ${status("en", "staff")}.</p><p>${esc(c.reason.slice(0, 300))}</p>${note}${btn(adminCaseUrl(c.number), "Open in admin")}`, `case_${kind}_staff`);
      }
    }
  } catch (e) {
    console.error("case email failed", e); // email trouble must never break a case action
  }
}

async function systemMessage(caseId: string, body: string) {
  await db.caseMessage.create({ data: { caseId, authorRole: "SYSTEM", authorName: "System", body, internal: false } });
}

/* ───────────────────────── creating a case ───────────────────────── */
export type CreateCaseInput = {
  user: { id: string; name: string; email: string } | null;
  order: (Order & { items: OrderItem[] }) | null;
  orderItemId?: string | null;
  quantity?: number | null;
  type: string;
  reason: string;
  requestedResolution: string;
  files: File[];
  email?: string; // required when there's no order and no user (not expected)
};

export async function createCase(input: CreateCaseInput): Promise<{ number: string } | { error: string }> {
  const type = input.type as (typeof CASE_TYPES)[number];
  if (!CASE_TYPES.includes(type)) return { error: "Please choose what went wrong." };
  const reason = input.reason.trim();
  if (reason.length < 10) return { error: "Please describe the problem in a little more detail (at least 10 characters)." };
  if (reason.length > 3000) return { error: "That description is too long. Please shorten it." };
  if (!input.order && !NO_ORDER_TYPES.includes(type)) return { error: "Please choose the order this is about." };
  const requested = ["REFUND", "REPLACEMENT", "REPAIR", "RETURN", "OTHER"].includes(input.requestedResolution) ? input.requestedResolution : "OTHER";
  const email = input.order?.email ?? input.user?.email ?? input.email;
  if (!email) return { error: "We need an email address to reach you." };

  let item: OrderItem | null = null;
  if (input.order && input.orderItemId) {
    item = input.order.items.find((i) => i.id === input.orderItemId) ?? null;
    if (!item) return { error: "That item isn't part of this order." };
  }
  const quantity = item ? Math.max(1, Math.min(item.quantity, Math.floor(input.quantity ?? item.quantity))) : null;

  const snapshot = input.order ? await buildPolicySnapshot(input.order, item) : {};
  const staffOnly = STAFF_ONLY_TYPES.includes(type);
  const sellerId = staffOnly ? null : item?.sellerId ?? null;
  if (staffOnly && item?.sellerId) snapshot.sellerId = item.sellerId; // kept for staff context only
  const status = type === "SAFETY" ? "ESCALATED" : sellerId ? "AWAITING_SELLER" : "IN_REVIEW";
  const due = sellerId ? dueFrom() : { sellerDueAt: null, escalateAt: null };

  let created: { id: string; number: string } | null = null;
  for (let attempt = 0; attempt < 3 && !created; attempt++) {
    try {
      created = await db.supportCase.create({
        data: {
          number: newCaseNumber(), type, status, userId: input.user?.id ?? input.order?.userId ?? null, email, orderId: input.order?.id ?? null, orderItemId: item?.id ?? null,
          sellerId, reason, requestedResolution: requested, quantity, policySnapshot: JSON.stringify(snapshot), ...due,
        },
        select: { id: true, number: true },
      });
    } catch (e) {
      if (attempt === 2) throw e;
    }
  }
  if (!created) return { error: "Could not create the case. Please try again." };

  const saved = await saveAttachments(input.files, created.id, input.user?.id);
  if (saved.error) {
    await db.supportCase.delete({ where: { id: created.id } });
    return { error: saved.error };
  }
  await db.caseMessage.create({
    data: { caseId: created.id, authorRole: "BUYER", authorId: input.user?.id ?? null, authorName: input.user?.name ?? input.order?.fullName ?? "Customer", body: reason, attachments: JSON.stringify(saved.ids) },
  });
  if (type === "SAFETY") await systemMessage(created.id, "Product-safety reports go straight to Karat support, who will review this as a priority.");
  if (input.order) await orderEvent(input.order.id, "case", `Support case ${created.number} opened (${typeLabel(type, "en")}).`, input.user?.id ?? undefined);

  await notify(created.id, "opened", { to: ["buyer", ...(sellerId ? (["seller"] as const) : []), ...(status !== "AWAITING_SELLER" ? (["staff"] as const) : [])] });
  return { number: created.number };
}

/* ───────────────────────── messages ───────────────────────── */
export async function addMessage(caseId: string, actor: Actor, body: string, opts: { internal?: boolean; files?: File[] } = {}): Promise<string | null> {
  const text = body.trim();
  if (!text && !(opts.files ?? []).some((f) => f.size > 0)) return "Please write a message or attach a file.";
  if (text.length > 5000) return "That message is too long.";
  const c = await db.supportCase.findUnique({ where: { id: caseId } });
  if (!c) return "Case not found.";
  if (actor.role !== "STAFF" && isFinal(c.status)) return "This case is closed. Reopen it to continue the conversation.";
  const internal = actor.role === "STAFF" && !!opts.internal;

  const saved = await saveAttachments(opts.files ?? [], caseId, actor.id);
  if (saved.error) return saved.error;
  await db.caseMessage.create({ data: { caseId, authorRole: actor.role, authorId: actor.id ?? null, authorName: actor.name, body: text || "(attachment)", internal, attachments: JSON.stringify(saved.ids) } });

  // automatic status movement
  let status = c.status;
  let due: { sellerDueAt: Date | null; escalateAt: Date | null } | null = null;
  if (!internal) {
    if (actor.role === "BUYER" && c.status === "AWAITING_BUYER") {
      status = c.sellerId ? "AWAITING_SELLER" : "IN_REVIEW";
      if (c.sellerId) due = dueFrom();
    } else if (actor.role === "SELLER" && c.status === "AWAITING_SELLER") {
      status = "AWAITING_BUYER";
      due = { sellerDueAt: null, escalateAt: null };
    }
  }
  await db.supportCase.update({ where: { id: caseId }, data: { status, ...(due ?? {}) } });

  if (!internal) {
    const to: ("buyer" | "seller" | "staff")[] = actor.role === "BUYER" ? (c.sellerId ? ["seller"] : ["staff"]) : actor.role === "SELLER" ? ["buyer"] : ["buyer", ...(c.sellerId ? (["seller"] as const) : [])];
    await notify(caseId, "message", { to, note: text, actorName: actor.role === "STAFF" ? "Karat support" : actor.name });
  }
  return null;
}

/* ───────────────────────── status changes ───────────────────────── */
export async function setStatus(
  caseId: string, to: string, actor: Actor, opts: { note?: string; notify?: boolean } = {},
): Promise<string | null> {
  const c = await db.supportCase.findUnique({ where: { id: caseId } });
  if (!c) return "Case not found.";
  if (c.status === to) return null;
  if (!canTransition(c.status, to)) return `A ${statusLabel(c.status, "en").toLowerCase()} case can't move to “${statusLabel(to, "en").toLowerCase()}”.`;

  const data: Record<string, unknown> = { status: to };
  if (isFinal(to)) Object.assign(data, { resolvedAt: c.resolvedAt ?? new Date(), sellerDueAt: null, escalateAt: null });
  if (isFinal(c.status) && !isFinal(to)) data.resolvedAt = null;
  if (to === "AWAITING_SELLER" && c.sellerId) Object.assign(data, dueFrom());
  if (to !== "AWAITING_SELLER" && c.status === "AWAITING_SELLER") Object.assign(data, { sellerDueAt: null, escalateAt: null });
  await db.supportCase.update({ where: { id: caseId }, data });
  await systemMessage(caseId, `${actor.role === "STAFF" ? "Karat support" : actor.name} changed the status to “${statusLabel(to, "en")}”.${opts.note ? ` ${opts.note}` : ""}`);
  if (c.orderId) await orderEvent(c.orderId, "case", `Case ${c.number}: ${statusLabel(to, "en")}.`, actor.id ?? undefined);
  if (actor.role === "STAFF") await logActivity({ id: actor.id ?? "", name: actor.name }, "updated", "case", `Case ${c.number} → ${statusLabel(to, "en")}`, c.id);
  if (opts.notify !== false) await notify(caseId, to === "ESCALATED" ? "escalated" : "status", { to: to === "ESCALATED" ? ["staff", "buyer"] : ["buyer", ...(c.sellerId ? (["seller"] as const) : [])], note: opts.note });
  return null;
}

/** Anyone involved may ask Karat to step in. */
export async function escalateCase(caseId: string, actor: Actor, reason: string): Promise<string | null> {
  const c = await db.supportCase.findUnique({ where: { id: caseId } });
  if (!c) return "Case not found.";
  if (isFinal(c.status)) return "This case is already closed.";
  if (c.status === "ESCALATED") return "This case has already been escalated to Karat support.";
  const text = reason.trim();
  if (text.length < 5) return "Please tell us briefly why you'd like Karat to step in.";
  await db.caseMessage.create({ data: { caseId, authorRole: actor.role, authorId: actor.id ?? null, authorName: actor.name, body: `Escalation requested: ${text}`, internal: false } });
  return setStatus(caseId, "ESCALATED", actor, { note: text });
}

export async function reopenCase(caseId: string, actor: Actor, reason: string): Promise<string | null> {
  const c = await db.supportCase.findUnique({ where: { id: caseId } });
  if (!c) return "Case not found.";
  if (!isFinal(c.status)) return "This case is still open.";
  const text = reason.trim();
  if (actor.role !== "STAFF") {
    const closedAt = c.resolvedAt ?? c.updatedAt;
    if (Date.now() - closedAt.getTime() > REOPEN_WINDOW_DAYS * 86400000) return `Cases can be reopened within ${REOPEN_WINDOW_DAYS} days. Please open a new case and mention ${c.number}.`;
    if (text.length < 10) return "Please explain why you're reopening this case.";
  }
  await db.caseMessage.create({ data: { caseId, authorRole: actor.role, authorId: actor.id ?? null, authorName: actor.name, body: `Case reopened${text ? `: ${text}` : "."}`, internal: false } });
  return setStatus(caseId, "IN_REVIEW", actor, { note: text });
}

export async function assignCase(caseId: string, staffId: string | null, actor: Actor) {
  const c = await db.supportCase.update({ where: { id: caseId }, data: { assignedTo: staffId } });
  await logActivity({ id: actor.id ?? "", name: actor.name }, "updated", "case", `Case ${c.number} assigned`, c.id);
}

/* ───────────────────────── proposals ───────────────────────── */
/** Largest amount refundable for this case's order line (never more than what's left on the order). */
export async function refundCap(caseId: string) {
  const c = await db.supportCase.findUnique({ where: { id: caseId }, include: { order: { include: { items: true } } } });
  if (!c?.order) return { cap: 0, line: 0, orderLeft: 0 };
  const orderLeft = Math.max(0, Math.round((c.order.total - c.order.refundedAmount) * 100) / 100);
  const item = c.orderItemId ? c.order.items.find((i) => i.id === c.orderItemId) : null;
  const qty = item ? Math.min(item.quantity, c.quantity ?? item.quantity) : 0;
  const line = item ? Math.round((item.price + item.warrantyPrice) * qty * 100) / 100 : orderLeft;
  const cap = Math.max(0, Math.min(orderLeft, Math.round((line - c.refundAmount) * 100) / 100));
  return { cap, line, orderLeft };
}

export async function proposeResolution(caseId: string, actor: Actor, p: { type: string; amount?: number; note?: string }): Promise<string | null> {
  if (actor.role !== "SELLER" && actor.role !== "STAFF") return "Not allowed.";
  if (!(PROPOSALS as readonly string[]).includes(p.type)) return "Choose a resolution to propose.";
  const c = await db.supportCase.findUnique({ where: { id: caseId } });
  if (!c) return "Case not found.";
  if (isFinal(c.status)) return "This case is closed.";
  let amount: number | null = null;
  if (p.type === "REFUND" || p.type === "PARTIAL_REFUND") {
    const { cap } = await refundCap(caseId);
    if (cap <= 0) return "There's nothing left to refund on this item.";
    amount = p.type === "REFUND" ? cap : Math.round((p.amount ?? 0) * 100) / 100;
    if (!(amount > 0)) return "Enter the refund amount you're proposing.";
    if (amount > cap + 0.001) return `The most that can be refunded here is AED ${cap}.`;
  }
  const proposal: Proposal = { type: p.type, amount, note: (p.note ?? "").trim().slice(0, 1500), by: actor.role === "SELLER" ? "SELLER" : "STAFF", byName: actor.role === "STAFF" ? "Karat support" : actor.name, at: new Date().toISOString() };
  await db.supportCase.update({ where: { id: caseId }, data: { proposedResolution: JSON.stringify(proposal), status: "PROPOSED", sellerDueAt: null, escalateAt: null } });
  await db.caseMessage.create({
    data: { caseId, authorRole: actor.role, authorId: actor.id ?? null, authorName: proposal.byName, body: `Proposed resolution: ${resolutionLabel(p.type, "en")}${amount ? ` (AED ${amount})` : ""}.${proposal.note ? `\n${proposal.note}` : ""}`, internal: false },
  });
  await notify(caseId, "proposal", { to: ["buyer", ...(actor.role === "STAFF" && c.sellerId ? (["seller"] as const) : [])], note: proposal.note });
  return null;
}

/** Buyer accepts or declines the latest proposal. Money moves only when Karat staff execute it (decideCase). */
export async function respondToProposal(caseId: string, actor: Actor, accept: boolean, comment: string): Promise<string | null> {
  const c = await db.supportCase.findUnique({ where: { id: caseId } });
  if (!c) return "Case not found.";
  const p = parseProposal(c.proposedResolution);
  if (!p || c.status !== "PROPOSED" || p.response) return "There's no open proposal to respond to.";
  if (!accept && comment.trim().length < 5) return "Please tell us briefly why this doesn't work for you.";
  p.response = accept ? "ACCEPTED" : "REJECTED";
  p.respondedAt = new Date().toISOString();
  await db.supportCase.update({ where: { id: caseId }, data: { proposedResolution: JSON.stringify(p) } });
  await db.caseMessage.create({
    data: { caseId, authorRole: "BUYER", authorId: actor.id ?? null, authorName: actor.name, body: `${accept ? "I accept" : "I don't accept"} the proposed resolution (${resolutionLabel(p.type, "en")}).${comment.trim() ? `\n${comment.trim()}` : ""}`, internal: false },
  });
  await setStatus(caseId, accept ? "IN_REVIEW" : "ESCALATED", actor, { notify: false, note: accept ? "Awaiting Karat to carry out the agreed resolution." : "Declined by the buyer, so Karat support will decide." });
  await notify(caseId, "response", { to: ["staff", ...(c.sellerId ? (["seller"] as const) : [])], note: comment });
  return null;
}

/* ───────────────────────── warranty / repair progress ───────────────────────── */
export async function updateRepairStatus(caseId: string, actor: Actor, status: string): Promise<string | null> {
  if (!(REPAIR_STATUSES as readonly string[]).includes(status)) return "Unknown repair status.";
  const c = await db.supportCase.findUnique({ where: { id: caseId } });
  if (!c) return "Case not found.";
  if (isFinal(c.status)) return "This case is closed.";
  await db.supportCase.update({ where: { id: caseId }, data: { repairStatus: status } });
  await systemMessage(caseId, `Repair update: ${status.replace(/_/g, " ").toLowerCase()}.`);
  if (c.orderId) await orderEvent(c.orderId, "case", `Case ${c.number} repair status: ${status.toLowerCase().replace(/_/g, " ")}.`, actor.id ?? undefined);
  if ((status === "SHIPPED_BACK" || status === "REPLACED") && c.status === "AWAITING_SELLER") await setStatus(caseId, "IN_REVIEW", actor, { notify: false });
  await notify(caseId, "status", { to: ["buyer"], note: `Repair status: ${status.replace(/_/g, " ").toLowerCase()}` });
  return null;
}

/* ───────────────────────── staff decision & execution ───────────────────────── */
export async function decideCase(
  caseId: string, staff: { id: string; name: string },
  d: { decision: string; amount?: number; note?: string },
): Promise<string | null> {
  if (!(DECISIONS as readonly string[]).includes(d.decision)) return "Choose a decision.";
  const c = await db.supportCase.findUnique({ where: { id: caseId }, include: { order: { include: { items: true } } } });
  if (!c) return "Case not found.";
  if (isFinal(c.status)) return "This case is already closed. Reopen it to record a new decision.";
  const note = (d.note ?? "").trim();
  const actor: Actor = { role: "STAFF", id: staff.id, name: staff.name };
  let summary = "";
  let finalStatus: "RESOLVED" | "IN_REVIEW" | "AWAITING_SELLER" = "RESOLVED";
  let refunded = 0;

  if (d.decision === "REJECTED") {
    if (note.length < 10) return "Please explain the decision in plain language (at least 10 characters). The customer will see this.";
    summary = "We were unable to approve this request.";
  } else if (d.decision === "REFUND" || d.decision === "PARTIAL_REFUND") {
    if (!c.order) return "This case isn't linked to an order, so there's nothing to refund.";
    const { cap } = await refundCap(caseId);
    if (cap <= 0) return "There's nothing left to refund for this item.";
    const amount = d.decision === "REFUND" && !(d.amount && d.amount > 0) ? cap : Math.round((d.amount ?? 0) * 100) / 100;
    if (!(amount > 0)) return "Enter the amount to refund.";
    if (amount > cap + 0.001) return `The most that can be refunded for this item is AED ${cap}.`;
    const err = await performRefund(c.order.id, amount, `Case ${c.number}${note ? `: ${note}` : ""}`, [], staff, false);
    if (err) return err;
    // charge the refund back to the seller who sold this item (only their share), if their earnings were already credited
    await applySellerRefund(c.order.id, amount, c.sellerId ?? undefined);
    refunded = amount;
    summary = `A refund of AED ${amount} has been issued to your original payment method.`;
  } else if (d.decision === "REPLACEMENT" || d.decision === "REPAIR") {
    summary = d.decision === "REPLACEMENT" ? "We've approved a replacement." : "We've approved a repair under warranty.";
    finalStatus = c.sellerId ? "AWAITING_SELLER" : "IN_REVIEW";
  } else if (d.decision === "RETURN") {
    if (!c.order) return "This case isn't linked to an order.";
    const open = await db.returnRequest.findFirst({ where: { orderId: c.order.id, status: { in: ["REQUESTED", "APPROVED"] } } });
    if (!open) {
      const item = c.orderItemId ? c.order.items.find((i) => i.id === c.orderItemId) : null;
      const items = item ? [{ orderItemId: item.id, quantity: Math.min(item.quantity, c.quantity ?? item.quantity) }] : c.order.items.map((i) => ({ orderItemId: i.id, quantity: i.quantity }));
      await db.returnRequest.create({ data: { orderId: c.order.id, userId: c.userId, reason: `Case ${c.number}: ${typeLabel(c.type, "en")}`, details: c.reason.slice(0, 500), items: JSON.stringify(items), status: "APPROVED", staffNote: `Approved from support case ${c.number}` } });
    }
    summary = "We've approved the return. We'll arrange collection and email you the details.";
    finalStatus = "IN_REVIEW";
  }

  await db.supportCase.update({
    where: { id: caseId },
    data: {
      decision: d.decision, decisionNote: note || null, refundAmount: c.refundAmount + refunded,
      status: finalStatus, resolvedAt: finalStatus === "RESOLVED" ? new Date() : null,
      ...(finalStatus === "AWAITING_SELLER" ? dueFrom() : { sellerDueAt: null, escalateAt: null }),
    },
  });
  await db.caseMessage.create({
    data: { caseId, authorRole: "STAFF", authorId: staff.id, authorName: "Karat support", body: `Decision: ${resolutionLabel(d.decision, "en")}. ${summary}${note ? `\n${note}` : ""}`, internal: false },
  });
  if (c.orderId) await orderEvent(c.orderId, "case", `Case ${c.number} decided: ${resolutionLabel(d.decision, "en")}${refunded ? ` (AED ${refunded} refunded)` : ""}.`, staff.id);
  await logActivity(staff, "decided", "case", `Case ${c.number}: ${resolutionLabel(d.decision, "en")}${refunded ? ` AED ${refunded}` : ""}`, c.id);
  await notify(caseId, "decision", { to: ["buyer", ...(c.sellerId ? (["seller"] as const) : [])], note: `${summary}${note ? `\n\n${note}` : ""}` });
  return null;
}

/* ───────────────────────── SLA escalation (cron) ───────────────────────── */
export async function escalateOverdueCases(now = new Date()) {
  const due = await db.supportCase.findMany({ where: { status: "AWAITING_SELLER", escalateAt: { lte: now } }, select: { id: true } });
  let n = 0;
  for (const { id } of due) {
    const err = await setStatus(id, "ESCALATED", SYSTEM, { note: "The seller didn't respond in time, so Karat support will take over.", notify: true });
    if (!err) {
      await notify(id, "reminder", { to: ["seller"], note: "This case was escalated because it didn't receive a response within the agreed time." });
      n++;
    }
  }
  return n;
}

/* ───────────────────────── scoped readers (every query hides internal notes from buyers & sellers) ───────────────────────── */
const PUBLIC_MESSAGES = { where: { internal: false }, orderBy: { createdAt: "asc" } } as const;

/** A buyer's case: by owner login, or by the signed key in an emailed link. Internal notes are never included. */
export async function getCaseForBuyer(number: string, user: { id: string } | null, key?: string | null) {
  const c = await db.supportCase.findUnique({
    where: { number },
    select: {
      id: true, number: true, type: true, status: true, userId: true, orderId: true, orderItemId: true, reason: true, requestedResolution: true, quantity: true, policySnapshot: true,
      proposedResolution: true, decision: true, decisionNote: true, refundAmount: true, repairStatus: true, resolvedAt: true, createdAt: true, updatedAt: true, sellerId: true,
      order: { select: { number: true } }, seller: { select: { shopName: true, slug: true } }, messages: PUBLIC_MESSAGES,
    },
  });
  if (!c) return null;
  if (!((user && c.userId === user.id) || verifyCaseKey(number, key))) return null;
  return c;
}

/** A seller's case: only cases assigned to their shop. No buyer email, no internal notes, only the buyer's name and emirate. */
export async function getCaseForSeller(number: string, sellerId: string) {
  return db.supportCase.findFirst({
    where: { number, sellerId },
    select: {
      id: true, number: true, type: true, status: true, orderItemId: true, reason: true, requestedResolution: true, quantity: true, policySnapshot: true, proposedResolution: true,
      decision: true, decisionNote: true, refundAmount: true, sellerDueAt: true, escalateAt: true, repairStatus: true, resolvedAt: true, createdAt: true, updatedAt: true,
      order: { select: { number: true, fullName: true, emirate: true, createdAt: true } }, messages: PUBLIC_MESSAGES,
    },
  });
}

/** Staff view: everything, including internal notes. */
export async function getCaseForStaff(number: string) {
  return db.supportCase.findUnique({
    where: { number },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      order: { include: { items: true } },
      seller: { select: { id: true, shopName: true, slug: true, email: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
}

export { ACTIVE_STATUSES };

export type ThreadMessage = {
  id: string; authorRole: string; authorName: string; body: string; internal: boolean; createdAt: Date;
  files: { id: string; filename: string; mime: string; size: number; href: string }[];
};
/** Resolves each message's attachments into short-lived signed links (only files owned by this case). */
export async function threadFor(caseId: string, messages: { id: string; authorRole: string; authorName: string; body: string; internal?: boolean; createdAt: Date; attachments: string }[]): Promise<ThreadMessage[]> {
  return Promise.all(messages.map(async (m) => ({
    id: m.id, authorRole: m.authorRole, authorName: m.authorName, body: m.body, internal: !!m.internal, createdAt: m.createdAt, files: await attachmentLinks(caseId, m.attachments),
  })));
}

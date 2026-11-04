// Pure (client + server safe) labels and helpers for support cases. No database access here.

export type Locale = "en" | "ar";

export const CASE_TYPES = [
  "NOT_RECEIVED", "DELAYED", "DAMAGED", "WRONG_ITEM", "MISSING_ACCESSORY", "CONDITION_MISMATCH", "BATTERY_MISMATCH", "DEFECTIVE",
  "WARRANTY", "RETURN", "REFUND_DELAYED", "PAYMENT", "SELLER_CONDUCT", "SAFETY", "PRIVACY", "OTHER",
] as const;
export type CaseType = (typeof CASE_TYPES)[number];

/** Types that don't have to be tied to an order line (and are never routed to the seller). */
export const NO_ORDER_TYPES: CaseType[] = ["PRIVACY", "OTHER", "SELLER_CONDUCT", "PAYMENT"];
/** Types handled by Karat staff only: the seller is not given the case. */
export const STAFF_ONLY_TYPES: CaseType[] = ["PRIVACY", "PAYMENT", "SELLER_CONDUCT"];

export const STATUSES = ["OPEN", "AWAITING_SELLER", "AWAITING_BUYER", "IN_REVIEW", "PROPOSED", "ESCALATED", "RESOLVED", "CLOSED"] as const;
export type CaseStatus = (typeof STATUSES)[number];
export const ACTIVE_STATUSES: CaseStatus[] = ["OPEN", "AWAITING_SELLER", "AWAITING_BUYER", "IN_REVIEW", "PROPOSED", "ESCALATED"];
/** Statuses that need a staff member to act. */
export const STAFF_ATTENTION: CaseStatus[] = ["OPEN", "IN_REVIEW", "ESCALATED"];

export const REQUESTED = ["REFUND", "REPLACEMENT", "REPAIR", "RETURN", "OTHER"] as const;
export const DECISIONS = ["REFUND", "PARTIAL_REFUND", "REPLACEMENT", "REPAIR", "RETURN", "REJECTED"] as const;
export const PROPOSALS = ["REFUND", "PARTIAL_REFUND", "REPLACEMENT", "REPAIR", "RETURN"] as const;
export const REPAIR_STATUSES = ["RECEIVED", "DIAGNOSING", "REPAIRING", "SHIPPED_BACK", "REPLACED"] as const;

const T: Record<string, [string, string]> = {
  NOT_RECEIVED: ["Item not received", "لم يصل الطلب"],
  DELAYED: ["Delivery delayed", "تأخر التوصيل"],
  DAMAGED: ["Damaged parcel", "الشحنة تالفة"],
  WRONG_ITEM: ["Wrong item received", "استلمت منتجًا خاطئًا"],
  MISSING_ACCESSORY: ["Missing accessory", "ملحق ناقص"],
  CONDITION_MISMATCH: ["Condition not as described", "الحالة تختلف عن الوصف"],
  BATTERY_MISMATCH: ["Battery not as described", "البطارية تختلف عن الوصف"],
  DEFECTIVE: ["Defective on arrival", "معطل عند الاستلام"],
  WARRANTY: ["Warranty fault", "عطل ضمن الضمان"],
  RETURN: ["Return request", "طلب إرجاع"],
  REFUND_DELAYED: ["Refund delayed", "تأخر الاسترداد"],
  PAYMENT: ["Payment issue", "مشكلة في الدفع"],
  SELLER_CONDUCT: ["Seller conduct", "سلوك البائع"],
  SAFETY: ["Product safety", "سلامة المنتج"],
  PRIVACY: ["Privacy / security issue", "مشكلة خصوصية أو أمان"],
  OTHER: ["Other", "أخرى"],
};
export const typeLabel = (t: string, l: Locale) => T[t]?.[l === "ar" ? 1 : 0] ?? t;

const S: Record<string, { en: string; ar: string; buyerEn?: string; buyerAr?: string }> = {
  OPEN: { en: "Open", ar: "مفتوحة" },
  AWAITING_SELLER: { en: "Awaiting seller", ar: "بانتظار البائع" },
  AWAITING_BUYER: { en: "Awaiting buyer", ar: "بانتظار المشتري", buyerEn: "Waiting for your reply", buyerAr: "بانتظار ردك" },
  IN_REVIEW: { en: "In review", ar: "قيد المراجعة" },
  PROPOSED: { en: "Resolution proposed", ar: "تم اقتراح حل", buyerEn: "Resolution proposed: please respond", buyerAr: "تم اقتراح حل: يرجى الرد" },
  ESCALATED: { en: "Escalated to Karat", ar: "تم التصعيد إلى الدعم" },
  RESOLVED: { en: "Resolved", ar: "تم الحل" },
  CLOSED: { en: "Closed", ar: "مغلقة" },
};
export function statusLabel(s: string, l: Locale, audience: "staff" | "buyer" | "seller" = "staff") {
  const e = S[s];
  if (!e) return s;
  if (audience === "buyer") return l === "ar" ? e.buyerAr ?? e.ar : e.buyerEn ?? e.en;
  if (audience === "seller" && s === "AWAITING_SELLER") return l === "ar" ? "بانتظار ردك" : "Action needed from you";
  return l === "ar" ? e.ar : e.en;
}
export const STATUS_TONE: Record<string, "green" | "yellow" | "red" | "blue" | "gray" | "purple"> = {
  OPEN: "blue", AWAITING_SELLER: "yellow", AWAITING_BUYER: "yellow", IN_REVIEW: "purple", PROPOSED: "blue", ESCALATED: "red", RESOLVED: "green", CLOSED: "gray",
};

const R: Record<string, [string, string]> = {
  REFUND: ["Full refund", "استرداد كامل"], PARTIAL_REFUND: ["Partial refund", "استرداد جزئي"], REPLACEMENT: ["Replacement", "استبدال"],
  REPAIR: ["Repair", "إصلاح"], RETURN: ["Return the item", "إرجاع المنتج"], OTHER: ["Other", "أخرى"], REJECTED: ["Request declined", "رفض الطلب"],
};
export const resolutionLabel = (r: string, l: Locale) => R[r]?.[l === "ar" ? 1 : 0] ?? r;

const RS: Record<string, [string, string]> = {
  RECEIVED: ["Item received for service", "تم استلام المنتج للصيانة"], DIAGNOSING: ["Diagnosing", "قيد التشخيص"], REPAIRING: ["Being repaired", "قيد الإصلاح"],
  SHIPPED_BACK: ["Shipped back to you", "تم شحنه إليك"], REPLACED: ["Replacement sent", "تم إرسال البديل"],
};
export const repairLabel = (r: string, l: Locale) => RS[r]?.[l === "ar" ? 1 : 0] ?? r;

/** Short human duration, e.g. "1d 4h", "3h 10m". */
export function humanDuration(ms: number, l: Locale = "en") {
  const abs = Math.abs(ms);
  const d = Math.floor(abs / 86400000), h = Math.floor((abs % 86400000) / 3600000), m = Math.floor((abs % 3600000) / 60000);
  const parts = d ? [`${d}${l === "ar" ? "ي" : "d"}`, `${h}${l === "ar" ? "س" : "h"}`] : h ? [`${h}${l === "ar" ? "س" : "h"}`, `${m}${l === "ar" ? "د" : "m"}`] : [`${m}${l === "ar" ? "د" : "m"}`];
  return parts.join(" ");
}

export type Sla = { label: string; tone: "green" | "yellow" | "red" | "gray"; overdue: boolean } | null;
/** Seller response deadline display. Pure so pages (server) and client components can share it. */
export function slaState(c: { status: string; sellerDueAt: Date | string | null; escalateAt?: Date | string | null }, now = new Date(), l: Locale = "en"): Sla {
  if (c.status === "ESCALATED") return { label: l === "ar" ? "مُصعَّدة" : "Escalated", tone: "red", overdue: true };
  if (c.status !== "AWAITING_SELLER" || !c.sellerDueAt) return null;
  const due = new Date(c.sellerDueAt).getTime();
  const diff = due - now.getTime();
  if (diff < 0) return { label: l === "ar" ? `متأخر ${humanDuration(diff, l)}` : `Overdue by ${humanDuration(diff)}`, tone: "red", overdue: true };
  return { label: l === "ar" ? `الرد خلال ${humanDuration(diff, l)}` : `Response due in ${humanDuration(diff)}`, tone: diff < 6 * 3600000 ? "yellow" : "green", overdue: false };
}

export type Snapshot = {
  source?: string; orderNumber?: string; sellerId?: string | null; sellerName?: string | null;
  item?: { name: string; variantTitle: string; sku: string | null; price: number; warrantyPrice: number; quantity: number } | null;
  condition?: Record<string, unknown> | null; warranty?: { provider?: string; months?: number; terms?: string | null } | null; returns?: { days?: number; terms?: string | null } | null;
  deliveredAt?: string | null; orderedAt?: string | null;
};
export function parseSnapshot(s: string | null | undefined): Snapshot {
  try { return s ? (JSON.parse(s) as Snapshot) : {}; } catch { return {}; }
}

const DAY = 86400000;
/** Informational: warranty period from the terms the buyer agreed to. Never used to block a case. */
export function warrantyInfo(snap: Snapshot, now = new Date()) {
  const months = snap.warranty?.months;
  const start = snap.deliveredAt ?? snap.orderedAt;
  if (!months || !start) return null;
  const end = new Date(start);
  end.setMonth(end.getMonth() + months);
  return { months, provider: snap.warranty?.provider ?? null, terms: snap.warranty?.terms ?? null, endsAt: end, daysLeft: Math.ceil((end.getTime() - now.getTime()) / DAY), fromDelivery: !!snap.deliveredAt };
}
export function returnWindowInfo(snap: Snapshot, now = new Date()) {
  const days = snap.returns?.days;
  const start = snap.deliveredAt ?? snap.orderedAt;
  if (days == null || !start) return null;
  const end = new Date(new Date(start).getTime() + days * DAY);
  return { days, terms: snap.returns?.terms ?? null, endsAt: end, daysLeft: Math.ceil((end.getTime() - now.getTime()) / DAY), fromDelivery: !!snap.deliveredAt };
}

export type Proposal = { type: string; amount?: number | null; note?: string; by: "SELLER" | "STAFF"; byName: string; at: string; response?: "ACCEPTED" | "REJECTED"; respondedAt?: string };
export function parseProposal(s: string | null | undefined): Proposal | null {
  try { return s ? (JSON.parse(s) as Proposal) : null; } catch { return null; }
}

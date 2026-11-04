import "server-only";
import type { Prisma } from "@prisma/client";

export type SP = Record<string, string | string[] | undefined>;
export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export const ORDER_TABS = [
  { key: "all", label: "All" },
  { key: "unfulfilled", label: "Unfulfilled" },
  { key: "unpaid", label: "Unpaid" },
  { key: "open", label: "Open" },
  { key: "archived", label: "Archived" },
  { key: "cancelled", label: "Cancelled" },
];

export function orderWhere(sp: SP): Prisma.OrderWhereInput {
  const tab = one(sp.tab) || "all";
  const and: Prisma.OrderWhereInput[] = [{ status: { not: "DRAFT" } }];
  if (tab === "unfulfilled") and.push({ status: "OPEN", fulfillmentStatus: "UNFULFILLED" });
  if (tab === "unpaid") and.push({ status: "OPEN", paymentStatus: "PENDING" });
  if (tab === "open") and.push({ status: "OPEN" });
  if (tab === "archived") and.push({ status: "ARCHIVED" });
  if (tab === "cancelled") and.push({ status: "CANCELLED" });
  const q = one(sp.q).trim();
  if (q)
    and.push({
      OR: [{ number: { contains: q.toUpperCase() } }, { email: { contains: q.toLowerCase() } }, { fullName: { contains: q } }, { phone: { contains: q } }],
    });
  if (one(sp.payment)) and.push({ paymentStatus: one(sp.payment) });
  if (one(sp.fulfillment)) and.push({ fulfillmentStatus: one(sp.fulfillment) });
  if (one(sp.method)) and.push({ paymentMethod: one(sp.method) });
  if (one(sp.emirate)) and.push({ emirate: one(sp.emirate) });
  if (one(sp.tag)) and.push({ tags: { contains: one(sp.tag) } });
  const from = one(sp.from), to = one(sp.to);
  if (from) and.push({ createdAt: { gte: new Date(from) } });
  if (to) and.push({ createdAt: { lte: new Date(to + "T23:59:59") } });
  return { AND: and };
}

export function customerWhere(sp: SP): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [{ role: "CUSTOMER" }];
  const q = one(sp.q).trim();
  if (q) and.push({ OR: [{ name: { contains: q } }, { email: { contains: q.toLowerCase() } }, { phone: { contains: q } }] });
  if (one(sp.marketing) === "yes") and.push({ acceptsMarketing: true });
  if (one(sp.marketing) === "no") and.push({ acceptsMarketing: false });
  if (one(sp.orders) === "yes") and.push({ orders: { some: {} } });
  if (one(sp.orders) === "no") and.push({ orders: { none: {} } });
  if (one(sp.tag)) and.push({ tags: { contains: one(sp.tag) } });
  return { AND: and };
}

export function qs(sp: SP, patch: Record<string, string | number | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v) p.set(k, v);
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === "") p.delete(k);
    else p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function toCsv(rows: (string | number | boolean | null | undefined)[][]) {
  return rows
    .map((r) => r.map((c) => {
      const s = c == null ? "" : String(c);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(","))
    .join("\r\n");
}

export function csvResponse(name: string, rows: (string | number | boolean | null | undefined)[][]) {
  return new Response("﻿" + toCsv(rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}

export function discountStatus(d: { active: boolean; startsAt: Date; endsAt: Date | null; usageLimit: number | null; usedCount: number }) {
  const now = new Date();
  if (!d.active) return { label: "Inactive", tone: "gray" as const };
  if (d.startsAt > now) return { label: "Scheduled", tone: "blue" as const };
  if (d.endsAt && d.endsAt < now) return { label: "Expired", tone: "gray" as const };
  if (d.usageLimit != null && d.usedCount >= d.usageLimit) return { label: "Limit reached", tone: "yellow" as const };
  return { label: "Active", tone: "green" as const };
}

export function Banner({ sp }: { sp: SP }) {
  const msg = one(sp.msg), err = one(sp.error);
  if (!msg && !err) return null;
  return err
    ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{err}</div>
    : <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">{msg}</div>;
}

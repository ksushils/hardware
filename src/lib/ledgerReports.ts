import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { toMinor } from "./money";
import { ACCOUNTS } from "./ledger";

const PAID_STATES = ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"];
const DUBAI_OFFSET_MS = 4 * 3600_000; // statements and monthly reports use Gulf Standard Time (UTC+4)

/** "2026-11" → [start, end) instants of that month in Dubai time. */
export function monthRange(ym: string): [Date, Date] {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(ym);
  if (!m) throw new Error("Invalid month, expected YYYY-MM");
  const y = Number(m[1]), mo = Number(m[2]);
  return [new Date(Date.UTC(y, mo - 1, 1) - DUBAI_OFFSET_MS), new Date(Date.UTC(y, mo, 1) - DUBAI_OFFSET_MS)];
}
export function currentMonth() {
  const d = new Date(Date.now() + DUBAI_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
export function recentMonths(n = 12) {
  const out: string[] = [];
  const d = new Date(Date.now() + DUBAI_OFFSET_MS);
  let y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
  for (let i = 0; i < n; i++) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m--; if (m === 0) { m = 12; y--; }
  }
  return out;
}
export function monthLabel(ym: string, locale = "en-GB") {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString(locale, { month: "long", year: "numeric", timeZone: "UTC" });
}

// ───────────────────────── CSV (formula-injection-safe) ─────────────────────────
/** Strings starting with = + - @ TAB or CR are prefixed with ' so spreadsheets never execute them. Numbers are written raw. */
export function csvCell(v: string | number | null | undefined) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function toCsv(rows: (string | number | null | undefined)[][]) {
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
export function csvResponse(name: string, rows: (string | number | null | undefined)[][]) {
  return new Response(toCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "private, no-store" } });
}

// ───────────────────────── Trial balance ─────────────────────────
export async function trialBalance() {
  const [net, debits, credits, perSeller, unbalanced] = await Promise.all([
    db.ledgerLine.groupBy({ by: ["account"], _sum: { amount: true } }),
    db.ledgerLine.groupBy({ by: ["account"], where: { amount: { gt: 0 } }, _sum: { amount: true } }),
    db.ledgerLine.groupBy({ by: ["account"], where: { amount: { lt: 0 } }, _sum: { amount: true } }),
    db.ledgerLine.groupBy({ by: ["sellerId"], where: { account: "SELLER_PAYABLE" }, _sum: { amount: true } }),
    db.$queryRaw<{ transactionId: string; s: number | bigint }[]>(Prisma.sql`SELECT "transactionId", SUM("amount") AS s FROM "LedgerLine" GROUP BY "transactionId" HAVING SUM("amount") <> 0`),
  ]);
  const accounts = Object.keys(ACCOUNTS).map((account) => {
    const d = debits.find((x) => x.account === account)?._sum.amount ?? 0;
    const c = credits.find((x) => x.account === account)?._sum.amount ?? 0;
    return { account, description: ACCOUNTS[account as keyof typeof ACCOUNTS], debit: d, credit: -c, balance: net.find((x) => x.account === account)?._sum.amount ?? 0 };
  });
  const total = net.reduce((s, x) => s + (x._sum.amount ?? 0), 0);
  return {
    accounts, total,
    sellerPayable: perSeller.map((x) => ({ sellerId: x.sellerId, owed: -(x._sum.amount ?? 0) })),
    unbalanced: unbalanced.map((x) => ({ transactionId: x.transactionId, sum: Number(x.s) })),
  };
}

// ───────────────────────── Month summary ─────────────────────────
export async function monthSummary(ym: string) {
  const [start, end] = monthRange(ym);
  const lines = await db.ledgerLine.findMany({ where: { transaction: { createdAt: { gte: start, lt: end } } }, select: { account: true, amount: true, transaction: { select: { kind: true } } } });
  const sum = (pred: (l: (typeof lines)[number]) => boolean) => lines.filter(pred).reduce((s, l) => s + l.amount, 0);
  const paid = (l: (typeof lines)[number]) => l.transaction.kind === "ORDER_PAID";
  return {
    ym, orders: await db.ledgerTransaction.count({ where: { kind: "ORDER_PAID", createdAt: { gte: start, lt: end } } }),
    grossBilled: -sum((l) => paid(l) && l.amount < 0), // everything credited at payment time, VAT-inclusive, before discounts
    discounts: sum((l) => paid(l) && l.account === "DISCOUNTS"),
    cashReceived: sum((l) => paid(l) && l.account === "CASH_CLEARING"),
    refunds: -sum((l) => l.transaction.kind === "REFUND" && l.account === "CASH_CLEARING"),
    storeSalesNet: -sum((l) => l.account === "SALES_REVENUE"),
    shippingNet: -sum((l) => l.account === "SHIPPING_REVENUE"),
    commissionNet: -sum((l) => l.account === "PLATFORM_COMMISSION"),
    vat: -sum((l) => l.account === "VAT_PAYABLE"),
    sellerPayableMovement: -sum((l) => l.account === "SELLER_PAYABLE"),
    payouts: sum((l) => l.transaction.kind === "PAYOUT" && l.account === "SELLER_PAYABLE"),
    providerFees: sum((l) => l.account === "PROVIDER_FEES"),
    adjustments: sum((l) => l.account === "ADJUSTMENTS"),
  };
}

// ───────────────────────── Reconciliation ─────────────────────────
function shareOfSubOrder(items: { sellerOrderId: string | null; price: number; quantity: number; commissionAmount: number }[], so: { id: string; shippingFee: number }) {
  let share = 0;
  for (const i of items) {
    if (i.sellerOrderId !== so.id) continue;
    const line = toMinor(i.price * i.quantity);
    share += line - Math.min(line, Math.max(0, toMinor(i.commissionAmount)));
  }
  return share + Math.max(0, toMinor(so.shippingFee ?? 0));
}

export async function reconciliation() {
  const [paidOrders, orderJournals, refunds, payouts, payoutJournals, cashLines, allTx, sellers, stTotals, earningTx, adjustments, payableLines] = await Promise.all([
    db.order.findMany({ where: { paymentStatus: { in: PAID_STATES } }, include: { items: true, sellerOrders: true }, orderBy: { createdAt: "desc" } }),
    db.ledgerTransaction.findMany({ where: { kind: "ORDER_PAID" }, select: { refId: true } }),
    db.refund.findMany({ select: { id: true, orderId: true, amount: true } }),
    db.payout.findMany({ where: { status: "PAID" } }),
    db.ledgerTransaction.findMany({ where: { kind: "PAYOUT" }, select: { refId: true } }),
    db.ledgerLine.findMany({ where: { account: "CASH_CLEARING" }, select: { amount: true, transaction: { select: { kind: true, refType: true, refId: true } } } }),
    db.ledgerTransaction.findMany({ where: { kind: { in: ["ORDER_PAID", "REFUND"] } }, select: { id: true, kind: true, refId: true } }),
    db.seller.findMany({ select: { id: true, shopName: true } }),
    db.sellerTransaction.groupBy({ by: ["sellerId"], _sum: { amount: true } }),
    db.sellerTransaction.findMany({ where: { type: "EARNING" }, select: { sellerOrderId: true } }),
    db.sellerTransaction.groupBy({ by: ["sellerId"], where: { type: "ADJUSTMENT" }, _sum: { amount: true } }),
    db.ledgerLine.groupBy({ by: ["sellerId"], where: { account: "SELLER_PAYABLE" }, _sum: { amount: true } }),
  ]);

  // (a) paid orders with no ORDER_PAID journal
  const posted = new Set(orderJournals.map((j) => j.refId));
  const unposted = paidOrders.filter((o) => !posted.has(o.id)).map((o) => ({ id: o.id, number: o.number, total: o.total, paymentStatus: o.paymentStatus, createdAt: o.createdAt }));

  // (c) ledger cash vs Order.total − refunds
  const refundOrder = new Map(refunds.map((r) => [r.id, r.orderId]));
  const txInfo = new Map(allTx.map((t) => [t.id, t]));
  const cashByOrder = new Map<string, number>();
  for (const l of cashLines) {
    const t = l.transaction;
    let orderId: string | undefined;
    if (t.kind === "ORDER_PAID") orderId = t.refId;
    else if (t.kind === "REFUND") orderId = refundOrder.get(t.refId);
    else if (t.kind === "REVERSAL") {
      const orig = txInfo.get(t.refId);
      if (orig?.kind === "ORDER_PAID") orderId = orig.refId;
      else if (orig?.kind === "REFUND") orderId = refundOrder.get(orig.refId);
    }
    if (orderId) cashByOrder.set(orderId, (cashByOrder.get(orderId) ?? 0) + l.amount);
  }
  const cashMismatch = paidOrders
    .filter((o) => posted.has(o.id))
    .map((o) => ({ id: o.id, number: o.number, expected: toMinor(o.total - o.refundedAmount), ledger: cashByOrder.get(o.id) ?? 0 }))
    .filter((x) => Math.abs(x.expected - x.ledger) > 1);

  // (d) paid payouts without journal
  const payoutPosted = new Set(payoutJournals.map((j) => j.refId));
  const payoutsUnposted = payouts.filter((p) => !payoutPosted.has(p.id)).map((p) => ({ id: p.id, sellerId: p.sellerId, amount: p.amount, paidAt: p.paidAt }));

  // (b) per-seller: ledger payable vs expected-from-sources vs SellerTransaction balance
  const credited = new Set(earningTx.map((t) => t.sellerOrderId).filter((x): x is string => !!x));
  const payoutSum = new Map<string, number>();
  for (const p of payouts) payoutSum.set(p.sellerId, (payoutSum.get(p.sellerId) ?? 0) + toMinor(p.amount));
  const expectedOrders = new Map<string, number>(), inTransit = new Map<string, number>(), refundCount = new Map<string, number>();
  for (const o of paidOrders) {
    const keep = o.total > 0 ? Math.max(0, 1 - o.refundedAmount / o.total) : 1;
    const nRefunds = refunds.filter((r) => r.orderId === o.id).length;
    for (const so of o.sellerOrders) {
      const share = shareOfSubOrder(o.items, so);
      const net = Math.round(share * keep);
      expectedOrders.set(so.sellerId, (expectedOrders.get(so.sellerId) ?? 0) + net);
      if (!credited.has(so.id)) inTransit.set(so.sellerId, (inTransit.get(so.sellerId) ?? 0) + net);
      refundCount.set(so.sellerId, (refundCount.get(so.sellerId) ?? 0) + nRefunds + 1);
    }
  }
  const sellerRows = sellers.map((s) => {
    const ledgerPayable = -(payableLines.find((x) => x.sellerId === s.id)?._sum.amount ?? 0);
    const adj = toMinor(adjustments.find((x) => x.sellerId === s.id)?._sum.amount ?? 0);
    const expected = (expectedOrders.get(s.id) ?? 0) - (payoutSum.get(s.id) ?? 0) + adj;
    const st = toMinor(stTotals.find((x) => x.sellerId === s.id)?._sum.amount ?? 0);
    const transit = inTransit.get(s.id) ?? 0;
    const tol = refundCount.get(s.id) ?? 1;
    const diffLedger = ledgerPayable - expected; // journals vs the orders/payouts/adjustments they should come from
    const diffBalances = st + transit - ledgerPayable; // seller-balance engine vs ledger (after in-transit earnings)
    return { sellerId: s.id, shopName: s.shopName, ledgerPayable, expected, sellerBalance: st, inTransit: transit, diffLedger, diffBalances, tol, error: Math.abs(diffLedger) > tol, review: Math.abs(diffBalances) > tol + 1 };
  }).filter((r) => r.ledgerPayable || r.expected || r.sellerBalance || r.inTransit);

  const tb = await trialBalance();
  return {
    generatedAt: new Date(), unposted, cashMismatch, payoutsUnposted, sellerRows, unbalanced: tb.unbalanced, trialBalanceTotal: tb.total,
    issues: unposted.length + cashMismatch.length + payoutsUnposted.length + sellerRows.filter((r) => r.error).length + tb.unbalanced.length + (tb.total !== 0 ? 1 : 0),
  };
}

// ───────────────────────── Seller statement ─────────────────────────
export type StatementRow = { date: Date; kind: "SALE" | "REFUND" | "PAYOUT" | "ADJUSTMENT" | "REVERSAL"; ref: string; description: string; gross?: number; commission?: number; delivery?: number; amount: number };

/** Monthly statement for one seller from the ledger (amounts the platform owes the seller; + increases, − decreases). */
export async function sellerStatement(sellerId: string, ym: string) {
  const [start, end] = monthRange(ym);
  const seller = await db.seller.findUnique({ where: { id: sellerId }, select: { id: true, shopName: true, email: true, trn: true, iban: true, slug: true } });
  if (!seller) return null;
  const [openAgg, lines] = await Promise.all([
    db.ledgerLine.aggregate({ where: { account: "SELLER_PAYABLE", sellerId, transaction: { createdAt: { lt: start } } }, _sum: { amount: true } }),
    db.ledgerLine.findMany({ where: { account: "SELLER_PAYABLE", sellerId, transaction: { createdAt: { gte: start, lt: end } } }, include: { transaction: true }, orderBy: { transaction: { createdAt: "asc" } } }),
  ]);
  const opening = -(openAgg._sum.amount ?? 0);
  const orderIds = [...new Set(lines.filter((l) => l.transaction.kind === "ORDER_PAID").map((l) => l.transaction.refId))];
  const refundIds = lines.filter((l) => l.transaction.kind === "REFUND").map((l) => l.transaction.refId);
  const [orders, refunds] = await Promise.all([
    db.order.findMany({ where: { id: { in: orderIds } }, include: { items: { where: { sellerId } }, sellerOrders: { where: { sellerId } } } }),
    db.refund.findMany({ where: { id: { in: refundIds } }, include: { order: { select: { number: true } } } }),
  ]);
  const rows: StatementRow[] = lines.map((l) => {
    const t = l.transaction, amount = -l.amount;
    const date = t.createdAt;
    if (t.kind === "ORDER_PAID") {
      const o = orders.find((x) => x.id === t.refId);
      const gross = o ? o.items.reduce((s, i) => s + toMinor(i.price * i.quantity), 0) : 0;
      const commission = o ? o.items.reduce((s, i) => s + Math.min(toMinor(i.price * i.quantity), Math.max(0, toMinor(i.commissionAmount))), 0) : 0;
      const delivery = o ? o.sellerOrders.reduce((s, so) => s + Math.max(0, toMinor(so.shippingFee ?? 0)), 0) : 0;
      return { date, kind: "SALE", ref: o?.number ?? t.refId, description: "Sale (net of commission) + delivery fee", gross, commission, delivery, amount };
    }
    if (t.kind === "REFUND") return { date, kind: "REFUND", ref: refunds.find((r) => r.id === t.refId)?.order.number ?? t.refId, description: "Refund to customer (your share)", amount };
    if (t.kind === "PAYOUT") return { date, kind: "PAYOUT", ref: t.note?.replace(/^.*ref /, "") ?? t.refId, description: "Payout to your bank account", amount };
    if (t.kind === "REVERSAL") return { date, kind: "REVERSAL", ref: t.refId, description: t.note ?? "Correcting entry", amount };
    return { date, kind: "ADJUSTMENT", ref: t.refId, description: t.note ?? "Adjustment", amount };
  });
  const by = (k: StatementRow["kind"]) => rows.filter((r) => r.kind === k).reduce((s, r) => s + r.amount, 0);
  const sales = rows.filter((r) => r.kind === "SALE");
  const totals = {
    gross: sales.reduce((s, r) => s + (r.gross ?? 0), 0), commission: sales.reduce((s, r) => s + (r.commission ?? 0), 0), delivery: sales.reduce((s, r) => s + (r.delivery ?? 0), 0),
    sales: by("SALE"), refunds: by("REFUND"), adjustments: by("ADJUSTMENT") + by("REVERSAL"), payouts: by("PAYOUT"),
  };
  const closing = opening + rows.reduce((s, r) => s + r.amount, 0);
  return { seller, ym, start, end, opening, rows, totals, closing, orderCount: sales.length };
}

export function statementCsv(st: NonNullable<Awaited<ReturnType<typeof sellerStatement>>>) {
  const d = (m: number | undefined) => (m === undefined ? "" : (m / 100).toFixed(2));
  return [
    ["Statement", st.seller.shopName, st.ym, "Currency", "AED"],
    ["Opening balance", d(st.opening)],
    [],
    ["Date (Dubai)", "Type", "Reference", "Description", "Gross sales", "Commission", "Delivery fee", "Amount to you"],
    ...st.rows.map((r) => [new Date(r.date.getTime() + DUBAI_OFFSET_MS).toISOString().slice(0, 16).replace("T", " "), r.kind, r.ref, r.description, d(r.gross), d(r.commission), d(r.delivery), d(r.amount)]),
    [],
    ["Closing balance", d(st.closing)],
  ];
}

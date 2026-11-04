import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { fromMinor } from "@/lib/money";
import { csvResponse, reconciliation, sellerStatement, statementCsv, trialBalance } from "@/lib/ledgerReports";

export const dynamic = "force-dynamic";
const dec = (m: number) => fromMinor(m);

// CSV exports for finance. Needs the "sellers" permission. All string cells are formula-injection-safe (see csvCell).
export async function GET(req: Request) {
  const user = await getUser();
  if (!user || !hasPermission(user, "sellers")) return new Response("Forbidden", { status: 403 });
  const u = new URL(req.url);
  const type = u.searchParams.get("type");

  if (type === "trial-balance") {
    const tb = await trialBalance();
    return csvResponse("trial-balance.csv", [["Account", "Description", "Debit", "Credit", "Balance (Dr+/Cr-)"], ...tb.accounts.map((a) => [a.account, a.description, dec(a.debit), dec(a.credit), dec(a.balance)]), ["TOTAL", "", dec(tb.accounts.reduce((s, a) => s + a.debit, 0)), dec(tb.accounts.reduce((s, a) => s + a.credit, 0)), dec(tb.total)]]);
  }

  if (type === "ledger") {
    const g = (k: string) => u.searchParams.get(k) || undefined;
    const w: Prisma.LedgerTransactionWhereInput = {};
    if (g("kind")) w.kind = g("kind");
    if (g("ref")) w.OR = [{ refId: { contains: g("ref")! } }, { note: { contains: g("ref")! } }];
    const created: Prisma.DateTimeFilter = {};
    if (g("from") && !isNaN(+new Date(g("from")!))) created.gte = new Date(g("from")!);
    if (g("to") && !isNaN(+new Date(g("to")!))) created.lt = new Date(+new Date(g("to")!) + 86400_000);
    if (Object.keys(created).length) w.createdAt = created;
    if (g("account") || g("seller")) w.lines = { some: { ...(g("account") ? { account: g("account") } : {}), ...(g("seller") ? { sellerId: g("seller") } : {}) } };
    const txs = await db.ledgerTransaction.findMany({ where: w, include: { lines: true }, orderBy: { createdAt: "desc" }, take: 5000 });
    const sellers = new Map((await db.seller.findMany({ select: { id: true, shopName: true } })).map((s) => [s.id, s.shopName]));
    return csvResponse("ledger.csv", [
      ["Date (UTC)", "Transaction", "Kind", "Ref type", "Ref", "Account", "Seller", "Debit", "Credit", "Memo", "Note"],
      ...txs.flatMap((t) => t.lines.map((l) => [t.createdAt.toISOString(), t.id, t.kind, t.refType, t.refId, l.account, l.sellerId ? sellers.get(l.sellerId) ?? l.sellerId : "", l.amount > 0 ? dec(l.amount) : "", l.amount < 0 ? dec(-l.amount) : "", l.memo ?? "", t.note ?? ""])),
    ]);
  }

  if (type === "reconciliation") {
    const r = await reconciliation();
    return csvResponse("reconciliation.csv", [
      ["Check", "Reference", "Detail", "Expected", "Ledger", "Difference"],
      ...r.unposted.map((o) => ["Paid order without journal", o.number, o.paymentStatus, dec(Math.round(o.total * 100)), "", ""]),
      ...r.cashMismatch.map((x) => ["Ledger cash vs order", x.number, "", dec(x.expected), dec(x.ledger), dec(x.ledger - x.expected)]),
      ...r.payoutsUnposted.map((p) => ["Paid payout without journal", p.id, "", dec(Math.round(p.amount * 100)), "", ""]),
      ...r.sellerRows.map((s) => ["Seller ledger vs sources", s.shopName, s.error ? "ERROR" : "ok", dec(s.expected), dec(s.ledgerPayable), dec(s.diffLedger)]),
      ...r.sellerRows.map((s) => ["Seller balance engine vs ledger", s.shopName, s.review ? "REVIEW" : "ok", dec(s.sellerBalance + s.inTransit), dec(s.ledgerPayable), dec(s.diffBalances)]),
      ...r.unbalanced.map((x) => ["Unbalanced transaction", x.transactionId, "", 0, dec(x.sum), dec(x.sum)]),
    ]);
  }

  if (type === "statement") {
    const sellerId = u.searchParams.get("seller") ?? "", ym = u.searchParams.get("ym") ?? "";
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)) return new Response("Bad month", { status: 400 });
    const st = await sellerStatement(sellerId, ym);
    if (!st) return new Response("Not found", { status: 404 });
    return csvResponse(`statement-${st.seller.slug}-${ym}.csv`, statementCsv(st));
  }
  return new Response("Unknown export type", { status: 400 });
}

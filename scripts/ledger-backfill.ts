// Idempotently posts ORDER_PAID / REFUND / PAYOUT journals for everything already paid. Safe to re-run (unique refs).
//   npx tsx scripts/ledger-backfill.ts
// It imports server-only modules, so run it with tsx (the `server-only` guard is neutralised below).
import Module from "node:module";
const origLoad = (Module as unknown as { _load: (...a: unknown[]) => unknown })._load;
(Module as unknown as { _load: (...a: unknown[]) => unknown })._load = function (request: unknown, ...rest: unknown[]) {
  if (request === "server-only") return {};
  return origLoad.call(this, request, ...rest);
};

async function main() {
  const { db } = await import("../src/lib/db");
  const { postOrderPaid, postRefund, postPayout } = await import("../src/lib/ledgerPosting");
  const { trialBalance } = await import("../src/lib/ledgerReports");
  const stats = { orders: 0, ordersSkipped: 0, refunds: 0, payouts: 0, errors: [] as string[] };

  const orders = await db.order.findMany({ where: { paymentStatus: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] } }, orderBy: { createdAt: "asc" }, select: { id: true, number: true } });
  for (const o of orders) {
    const had = await db.ledgerTransaction.findUnique({ where: { kind_refType_refId: { kind: "ORDER_PAID", refType: "ORDER", refId: o.id } } });
    try { await postOrderPaid(o.id); had ? stats.ordersSkipped++ : stats.orders++; } catch (e) { stats.errors.push(`order ${o.number}: ${(e as Error).message}`); }
  }
  for (const r of await db.refund.findMany({ where: { amount: { gt: 0 } }, orderBy: { createdAt: "asc" } })) {
    try { if (!(await db.ledgerTransaction.findUnique({ where: { kind_refType_refId: { kind: "REFUND", refType: "REFUND", refId: r.id } } }))) { await postRefund(r.id); stats.refunds++; } } catch (e) { stats.errors.push(`refund ${r.id}: ${(e as Error).message}`); }
  }
  for (const p of await db.payout.findMany({ where: { status: "PAID" } })) {
    try { if (!(await db.ledgerTransaction.findUnique({ where: { kind_refType_refId: { kind: "PAYOUT", refType: "PAYOUT", refId: p.id } } }))) { await postPayout(p.id); stats.payouts++; } } catch (e) { stats.errors.push(`payout ${p.id}: ${(e as Error).message}`); }
  }
  const tb = await trialBalance();
  console.log(`posted: ${stats.orders} orders (${stats.ordersSkipped} already posted), ${stats.refunds} refunds, ${stats.payouts} payouts`);
  console.log(`trial balance total: ${tb.total} (must be 0) · unbalanced transactions: ${tb.unbalanced.length}`);
  for (const e of stats.errors) console.log("  ERROR", e);
  await db.$disconnect();
  if (tb.total !== 0 || tb.unbalanced.length) process.exit(2);
}
main();

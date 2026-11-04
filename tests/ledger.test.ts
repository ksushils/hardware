import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getUser: async () => null }));
vi.mock("@/lib/mailer", () => ({ sendEmail: async () => {}, btn: () => "" }));

// Ledger invariants: money maths, balanced + idempotent + immutable journals, refunds/payouts, reconciliation, statements, CSV safety.
const ok = (c: boolean, m: string) => expect(c, m).toBe(true);

describe("double-entry ledger", () => {
  it("holds every accounting invariant", async () => {


  const { allocate, toMinor, fromMinor, formatMoney, minorToDecimal, roundHalfAwayFromZero } = await import("@/lib/money");
  const { postJournal, assertBalanced } = await import("@/lib/ledger");
  const P = await import("@/lib/ledgerPosting");
  const R = await import("@/lib/ledgerReports");
  const { db } = await import("@/lib/db");
  const { applyLedgerTriggers } = await import("../scripts/apply-ledger-triggers");
  await applyLedgerTriggers(db);
  const { makeSeller } = await import("./helpers/factories");

  // ── money
  ok(toMinor(1.005) === 101 && toMinor(-1.005) === -101, "toMinor rounds half away from zero (1.005 → 101, −1.005 → −101)");
  ok(toMinor(0.1 + 0.2) === 30, "toMinor strips float noise (0.1+0.2 → 30)");
  ok(toMinor(12.3456, "KWD") === 12346 && fromMinor(12346, "KWD") === 12.346, "3-decimal currency (KWD 12.3456 → 12346 fils-thousandths)");
  ok(minorToDecimal(12346, "KWD") === "12.346" && minorToDecimal(1205, "AED") === "12.05", "decimal strings use currency precision");
  ok(formatMoney(100000, "BHD", "en-GB") === "BHD 100.000", "formatMoney BHD 3 dp");
  ok(roundHalfAwayFromZero(-2.5) === -3 && roundHalfAwayFromZero(2.5) === 3, "half away from zero");
  for (const [t, w] of [[100, [1, 1, 1]], [10, [1, 1, 1]], [-7, [3, 2]], [1, [1, 1, 1, 1]], [999, [0.3, 0.3, 0.4]], [0, [1, 2]], [5, [0, 5, 0]]] as [number, number[]][]) {
    const parts = allocate(t, w);
    ok(parts.reduce((a, b) => a + b, 0) === t, `allocate(${t}, [${w}]) = [${parts}] sums exactly`);
  }
  ok(JSON.stringify(allocate(100, [1, 1, 1])) === "[34,33,33]", "largest remainder gives the extra unit to the first tie");
  try { allocate(5, [0, 0]); ok(false, "allocate over zero weights should throw"); } catch { ok(true, "allocate over all-zero weights throws"); }

  // ── journal validation
  try { assertBalanced([{ account: "CASH_CLEARING", amount: 100 }, { account: "SALES_REVENUE", amount: -99 }]); ok(false, "unbalanced"); } catch (e) { ok(/Unbalanced/.test((e as Error).message), "unbalanced journal rejected"); }
  try { await postJournal({ kind: "T", refType: "T", refId: "x", lines: [] }); ok(false, "empty"); } catch { ok(true, "empty journal rejected"); }
  try { assertBalanced([{ account: "CASH_CLEARING", amount: 1.5 }, { account: "SALES_REVENUE", amount: -1.5 }]); ok(false, "float"); } catch { ok(true, "non-integer amounts rejected"); }
  try { assertBalanced([{ account: "SELLER_PAYABLE", amount: 5 }, { account: "CASH_CLEARING", amount: -5 }]); ok(false, "seller"); } catch { ok(true, "SELLER_PAYABLE without sellerId rejected"); }
  const j1 = await postJournal({ kind: "TEST", refType: "TEST", refId: "dup1", lines: [{ account: "PROVIDER_FEES", amount: 500 }, { account: "CASH_CLEARING", amount: -500 }] });
  const j2 = await postJournal({ kind: "TEST", refType: "TEST", refId: "dup1", lines: [{ account: "PROVIDER_FEES", amount: 700 }, { account: "CASH_CLEARING", amount: -700 }] });
  ok(j1.id === j2.id && (await db.ledgerTransaction.count({ where: { refId: "dup1" } })) === 1 && j2.lines[0].amount === 500, "duplicate post is a no-op (same transaction, original amounts kept)");
  const [par] = await Promise.all([postJournal({ kind: "TEST", refType: "TEST", refId: "race", lines: [{ account: "PROVIDER_FEES", amount: 1 }, { account: "CASH_CLEARING", amount: -1 }] }), postJournal({ kind: "TEST", refType: "TEST", refId: "race", lines: [{ account: "PROVIDER_FEES", amount: 1 }, { account: "CASH_CLEARING", amount: -1 }] })]);
  ok((await db.ledgerTransaction.count({ where: { refId: "race" } })) === 1, "concurrent duplicate posts create exactly one transaction");

  // ── immutability (triggers)
  for (const sql of [`UPDATE "LedgerLine" SET amount = 1 WHERE id = '${j1.lines[0].id}'`, `DELETE FROM "LedgerLine" WHERE id = '${j1.lines[0].id}'`, `UPDATE "LedgerTransaction" SET note = 'x' WHERE id = '${j1.id}'`, `DELETE FROM "LedgerTransaction" WHERE id = '${j1.id}'`]) {
    try { await db.$executeRawUnsafe(sql); ok(false, `trigger should block: ${sql.slice(0, 40)}`); } catch (e) { ok(/immutable/.test(String(e)), `DB blocks: ${sql.slice(0, 44)}…`); }
  }
  try { await db.ledgerLine.update({ where: { id: j1.lines[0].id }, data: { amount: 9 } }); ok(false, "prisma update"); } catch { ok(true, "Prisma update on ledger is rejected too"); }

  // ── marketplace order: seller item + store items w/ Care+, discount, gift card, seller delivery fee
  const seller = await makeSeller();
  const order = await db.order.create({ data: {
    number: "TR-LEDGER-1", email: "t@example.com", paymentMethod: "CARD", paymentStatus: "PAID", status: "OPEN", subtotal: 1805, discount: 50, discountCode: "UAE50", shipping: 25, codFee: 0, giftCardCode: "G", giftCardAmount: 100,
    vat: 80, total: 1680, shippingRateName: "Standard", fullName: "T", phone: "0501234567", emirate: "Dubai", area: "a", street: "s", building: "b",
    items: { create: [
      { name: "Seller GPU", image: "", price: 1149, quantity: 1, sellerId: seller.id, commissionAmount: 80.43, sellerEarning: 1068.57 },
      { name: "Store RAM", image: "", price: 299, quantity: 2, warranty: true, warrantyPrice: 29 },
    ] },
  }, include: { items: true } });
  const so = await db.sellerOrder.create({ data: { orderId: order.id, sellerId: seller.id, subtotal: 1149, commissionTotal: 80.43, sellerEarning: 1068.57, shippingFee: 15 } });
  await db.orderItem.update({ where: { id: order.items[0].id }, data: { sellerOrderId: so.id } });

  const tx = await P.postOrderPaid(order.id);
  const sum = tx!.lines.reduce((s, l) => s + l.amount, 0);
  const by = (a: string) => tx!.lines.filter((l) => l.account === a).reduce((s, l) => s + l.amount, 0);
  ok(sum === 0, `ORDER_PAID balances exactly (sum ${sum}) — lines: ${tx!.lines.map((l) => `${l.account}${l.sellerId ? "[s]" : ""} ${l.amount}`).join(", ")}`);
  ok(by("CASH_CLEARING") === 168000 && by("GIFT_CARD_LIABILITY") === 10000 && by("DISCOUNTS") === 5000, "debits = cash 1680.00 + gift 100.00 + discount 50.00");
  ok(by("SELLER_PAYABLE") === -(106857 + 1500), "seller payable = earning 1068.57 + delivery fee 15.00");
  ok(by("PLATFORM_COMMISSION") + by("VAT_PAYABLE") !== 0 && by("PLATFORM_COMMISSION") === -Math.round(8043 / 1.05), "commission booked ex-VAT");
  ok(by("ROUNDING") === 0, "no rounding residue on this order");
  ok((await P.postOrderPaid(order.id))!.id === tx!.id, "posting the same paid order twice is a no-op");

  // refund 420 (25%)
  const refund = await db.refund.create({ data: { orderId: order.id, amount: 420, reason: "test" } });
  const rtx = await P.postRefund(refund.id);
  const rsum = rtx!.lines.reduce((s, l) => s + l.amount, 0);
  ok(rsum === 0, `REFUND balances exactly (sum ${rsum})`);
  const rb = (a: string) => rtx!.lines.filter((l) => l.account === a).reduce((s, l) => s + l.amount, 0);
  ok(rb("CASH_CLEARING") === -42000, "refund returns 420.00 cash");
  ok(Math.abs(rb("SELLER_PAYABLE") - Math.round(108357 * 0.25)) <= 1, `seller share reversed pro rata (${rb("SELLER_PAYABLE")} = 25% of 1083.57)`);
  ok((await P.postRefund(refund.id))!.id === rtx!.id, "duplicate refund post is a no-op");
  await db.order.update({ where: { id: order.id }, data: { refundedAmount: 420, paymentStatus: "PARTIALLY_REFUNDED" } });

  // payout + adjustment
  const payout = await db.payout.create({ data: { sellerId: seller.id, amount: 300, status: "PAID", reference: "BANK123", paidAt: new Date() } });
  await db.sellerTransaction.create({ data: { sellerId: seller.id, type: "PAYOUT", amount: -300, payoutId: payout.id } });
  const ptx = await P.postPayout(payout.id);
  ok(ptx!.lines.reduce((s, l) => s + l.amount, 0) === 0 && ptx!.lines.find((l) => l.account === "SELLER_PAYABLE")!.amount === 30000, "PAYOUT balances: Dr SELLER_PAYABLE 300.00");
  const st = await db.sellerTransaction.create({ data: { sellerId: seller.id, type: "ADJUSTMENT", amount: -12.5, note: "damaged goods" } });
  const atx = await P.postAdjustment(st.id);
  ok(atx!.lines.reduce((s, l) => s + l.amount, 0) === 0 && atx!.lines.find((l) => l.account === "SELLER_PAYABLE")!.amount === 1250, "ADJUSTMENT of −12.50 debits seller payable 12.50");
  const fee = await P.postProviderFee({ amount: 33.4, idempotencyKey: "fee-key-1", note: "Stripe fee" });
  await P.postProviderFee({ amount: 33.4, idempotencyKey: "fee-key-1" });
  ok(fee.lines.reduce((s, l) => s + l.amount, 0) === 0 && (await db.ledgerTransaction.count({ where: { refId: "fee-key-1" } })) === 1, "PROVIDER_FEE balances and the idempotency key blocks a double submit");

  // reversal
  const rev = await P.reverseTransaction(fee.id, "entered twice");
  ok(rev.lines.every((l) => fee.lines.find((x) => x.account === l.account)!.amount === -l.amount), "reversal negates every line");
  try { await P.reverseTransaction(rev.id, "x"); ok(false, "reversing a reversal"); } catch { ok(true, "a reversal can't itself be reversed"); }
  await P.reverseTransaction(fee.id, "again").then((r) => ok(r.id === rev.id, "second reversal of the same entry is a no-op"));

  // reports
  const tb = await R.trialBalance();
  ok(tb.total === 0 && tb.unbalanced.length === 0, `trial balance totals zero across ${tb.accounts.filter((a) => a.debit || a.credit).length} active accounts`);
  const rec = await R.reconciliation();
  const sr = rec.sellerRows.find((r) => r.sellerId === seller.id)!;
  ok(!sr.error, `reconciliation: seller ledger ${sr.ledgerPayable} vs expected-from-sources ${sr.expected} (diff ${sr.diffLedger}, tol ${sr.tol})`);
  ok(!sr.review, `seller-balance engine (${sr.sellerBalance}) + in-transit earnings (${sr.inTransit}) agrees with the ledger (diff ${sr.diffBalances})`);
  ok(!rec.cashMismatch.find((x) => x.id === order.id), "reconciliation: ledger cash == Order.total − refunds for the test order");
  const paidOrder2 = await db.order.create({ data: { number: "TR-LEDGER-2", email: "t@example.com", paymentMethod: "COD", paymentStatus: "PAID", status: "OPEN", subtotal: 100, shipping: 15, codFee: 10, vat: 5.95, total: 125, shippingRateName: "S", fullName: "T", phone: "0501234567", emirate: "Dubai", area: "a", street: "s", building: "b", items: { create: [{ name: "Store item", image: "", price: 100, quantity: 1 }] } } });
  const rec2 = await R.reconciliation();
  ok(rec2.unposted.some((u) => u.id === paidOrder2.id), "reconciliation lists a PAID order that has no ledger journal");
  await P.postOrderPaid(paidOrder2.id);
  const rec3 = await R.reconciliation();
  ok(!rec3.unposted.some((u) => u.id === paidOrder2.id), "…and it disappears once posted");
  const bad = await db.order.create({ data: { number: "TR-LEDGER-BAD", email: "t@example.com", paymentMethod: "CARD", paymentStatus: "PAID", status: "OPEN", subtotal: 100, shipping: 0, vat: 5, total: 90, shippingRateName: "S", fullName: "T", phone: "0501234567", emirate: "Dubai", area: "a", street: "s", building: "b", items: { create: [{ name: "x", image: "", price: 100, quantity: 1 }] } } });
  await P.postOrderPaidSafe(bad.id);
  ok((await db.ledgerTransaction.count({ where: { refId: bad.id } })) === 0 && (await db.orderEvent.count({ where: { orderId: bad.id, type: "ledger_error" } })) === 1, "inconsistent order totals are NOT posted; a LEDGER_ERROR event is recorded instead (order flow unaffected)");

  const ym = R.currentMonth();
  const ms = await R.monthSummary(ym);
  ok(ms.orders >= 2 && ms.refunds === 42000 && ms.payouts === 30000 && ms.providerFees === 501, `month summary ${ym}: orders ${ms.orders}, billed ${ms.grossBilled}, commission ${ms.commissionNet}, refunds ${ms.refunds}, payouts ${ms.payouts}, fees ${ms.providerFees}`);
  const stmt = await R.sellerStatement(seller.id, ym);
  const calc = stmt!.opening + stmt!.rows.reduce((s, r) => s + r.amount, 0);
  ok(stmt!.closing === calc && stmt!.closing === -(await R.trialBalance()).sellerPayable.find((x) => x.sellerId === seller.id)!.owed * -1, `seller statement closing ${stmt!.closing} = ledger owed to seller`);
  ok(stmt!.rows.some((r) => r.kind === "SALE" && r.gross === 114900 && r.commission === 8043 && r.delivery === 1500), "statement sale row shows gross 1149.00, commission 80.43, delivery fee 15.00");
  const csv = R.toCsv([["=cmd|' /C calc'!A0", "+1+2", "-5", "@x", 'a,"b"', -12.5, "ok"]]);
  ok(csv.includes("'=cmd") && csv.includes("'+1+2") && csv.includes("'-5") && csv.includes("'@x") && csv.includes(",-12.5,"), "CSV neutralises = + - @ strings but keeps real negative numbers");
  });
});

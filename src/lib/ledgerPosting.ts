import "server-only";
import { db } from "./db";
import { orderEvent } from "./activity";
import { getSettings } from "./settings";
import { allocate, roundHalfAwayFromZero, toMinor } from "./money";
import { LedgerError, getJournal, postJournal, type JournalLine } from "./ledger";

/** Maximum |debits − credits| (in minor units) that may be absorbed in the ROUNDING account for one order. */
export const ROUNDING_TOLERANCE = 5;
const PAID_STATES = ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"];

function splitVat(grossMinor: number, ratePct: number) {
  if (grossMinor <= 0) return { net: grossMinor, vat: 0 };
  const net = roundHalfAwayFromZero(grossMinor / (1 + ratePct / 100));
  return { net, vat: grossMinor - net };
}

/**
 * ORDER_PAID journal for an order whose payment has been received.
 *   Dr CASH_CLEARING        Order.total (money actually received)
 *   Dr GIFT_CARD_LIABILITY  gift-card amount redeemed
 *   Dr DISCOUNTS            store-funded discount
 *   Cr SELLER_PAYABLE[s]    each seller's earning (price×qty − commission) + that seller's shipping fee
 *   Cr PLATFORM_COMMISSION  commission ex-VAT
 *   Cr SALES_REVENUE        store-owned items + Care+ ex-VAT
 *   Cr SHIPPING_REVENUE     store shipments + COD fee ex-VAT
 *   Cr VAT_PAYABLE          VAT on the three revenue lines above
 * Sellers' own VAT on their goods is the seller's responsibility and is not recorded here.
 */
export async function postOrderPaid(orderId: string) {
  const existing = await db.ledgerTransaction.findUnique({ where: { kind_refType_refId: { kind: "ORDER_PAID", refType: "ORDER", refId: orderId } }, include: { lines: true } });
  if (existing) return existing;
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true, sellerOrders: true } });
  if (!order) throw new LedgerError(`Order ${orderId} not found`);
  if (!PAID_STATES.includes(order.paymentStatus)) return null;
  const rate = (await getSettings()).tax.rate;

  let storeSalesGross = 0, commissionGross = 0;
  const earn = new Map<string, number>();
  for (const i of order.items) {
    const line = toMinor(i.price * i.quantity);
    const warranty = i.warranty ? toMinor(i.warrantyPrice * i.quantity) : 0;
    storeSalesGross += warranty; // Care+ is always the store's product
    if (i.sellerId) {
      const comm = Math.min(line, Math.max(0, toMinor(i.commissionAmount)));
      commissionGross += comm;
      earn.set(i.sellerId, (earn.get(i.sellerId) ?? 0) + (line - comm));
    } else storeSalesGross += line;
  }
  let sellerShipTotal = 0;
  for (const so of order.sellerOrders) {
    const fee = Math.max(0, toMinor(so.shippingFee ?? 0));
    sellerShipTotal += fee;
    earn.set(so.sellerId, (earn.get(so.sellerId) ?? 0) + fee);
  }
  const storeShipGross = Math.max(0, toMinor(order.shipping) - sellerShipTotal) + Math.max(0, toMinor(order.codFee));

  const sales = splitVat(storeSalesGross, rate), comm = splitVat(commissionGross, rate), ship = splitVat(storeShipGross, rate);
  const credits: JournalLine[] = [];
  for (const [sellerId, amt] of earn) if (amt) credits.push({ account: "SELLER_PAYABLE", sellerId, amount: -amt, memo: "Seller earning + delivery fee" });
  if (comm.net) credits.push({ account: "PLATFORM_COMMISSION", amount: -comm.net });
  if (sales.net) credits.push({ account: "SALES_REVENUE", amount: -sales.net });
  if (ship.net) credits.push({ account: "SHIPPING_REVENUE", amount: -ship.net });
  const vat = sales.vat + comm.vat + ship.vat;
  if (vat) credits.push({ account: "VAT_PAYABLE", amount: -vat });

  const debits: JournalLine[] = [];
  const cash = toMinor(order.total), gift = toMinor(order.giftCardAmount), disc = toMinor(order.discount);
  if (cash) debits.push({ account: "CASH_CLEARING", amount: cash, memo: order.paymentMethod });
  if (gift) debits.push({ account: "GIFT_CARD_LIABILITY", amount: gift });
  if (disc) debits.push({ account: "DISCOUNTS", amount: disc, memo: order.discountCode ?? undefined });

  const diff = credits.reduce((s, l) => s + l.amount, 0) + debits.reduce((s, l) => s + l.amount, 0); // debits − credits
  if (Math.abs(diff) > ROUNDING_TOLERANCE)
    throw new LedgerError(`Order ${order.number}: items, shipping and discounts don't add up to the amount charged (out by ${diff} minor units) — check the order totals`);
  const lines = [...debits, ...credits];
  if (diff !== 0) lines.push({ account: "ROUNDING", amount: -diff });
  return postJournal({ kind: "ORDER_PAID", refType: "ORDER", refId: order.id, note: `Order ${order.number} paid (${order.paymentMethod})`, lines });
}

/**
 * REFUND journal: reverses the order's ORDER_PAID journal in proportion refund ÷ order total.
 * Cash goes back out; seller payable, commission, revenue and VAT are reversed pro rata (largest-remainder allocation, exact).
 * Gift-card/discount debit lines are reversed pro rata too; restoring the gift card balance itself is NOT automated by the app.
 */
export async function postRefund(refundId: string) {
  const refund = await db.refund.findUnique({ where: { id: refundId } });
  if (!refund) throw new LedgerError(`Refund ${refundId} not found`);
  const done = await getJournal("REFUND", "REFUND", refund.id);
  if (done) return done;
  const order = await db.order.findUnique({ where: { id: refund.orderId } });
  if (!order) throw new LedgerError(`Order for refund ${refundId} not found`);
  const orig = (await postOrderPaid(order.id)) ?? null;
  if (!orig) throw new LedgerError(`Order ${order.number} has no ORDER_PAID journal to reverse`);
  const A = toMinor(refund.amount);
  const orderCash = orig.lines.filter((l) => l.account === "CASH_CLEARING").reduce((s, l) => s + l.amount, 0);
  if (A <= 0) return null;
  if (orderCash <= 0) throw new LedgerError(`Order ${order.number} was not paid in cash; nothing to refund`);
  const otherDebits = orig.lines.filter((l) => l.amount > 0 && l.account !== "CASH_CLEARING");
  const creditLines = orig.lines.filter((l) => l.amount < 0);

  const lines: JournalLine[] = [{ account: "CASH_CLEARING", amount: -A, memo: "Refund to customer" }];
  let debitReversed = 0;
  for (const l of otherDebits) {
    const r = Math.min(l.amount, roundHalfAwayFromZero((l.amount * A) / orderCash));
    debitReversed += r;
    if (r) lines.push({ account: l.account as JournalLine["account"], sellerId: l.sellerId, amount: -r });
  }
  const creditTotal = A + debitReversed;
  const parts = allocate(creditTotal, creditLines.map((l) => l.amount));
  creditLines.forEach((l, idx) => {
    if (parts[idx]) lines.push({ account: l.account as JournalLine["account"], sellerId: l.sellerId, amount: parts[idx] });
  });
  return postJournal({ kind: "REFUND", refType: "REFUND", refId: refund.id, note: `Refund on order ${order.number}${refund.reason ? ` (${refund.reason})` : ""}`, lines });
}

/** PAYOUT journal when an admin marks a payout PAID: Dr SELLER_PAYABLE, Cr PAYOUTS_CLEARING. */
export async function postPayout(payoutId: string) {
  const p = await db.payout.findUnique({ where: { id: payoutId } });
  if (!p) throw new LedgerError(`Payout ${payoutId} not found`);
  if (p.status !== "PAID") return null;
  const amt = toMinor(p.amount);
  return postJournal({
    kind: "PAYOUT", refType: "PAYOUT", refId: p.id, note: `Payout to seller${p.reference ? ` ref ${p.reference}` : ""}`,
    lines: [{ account: "SELLER_PAYABLE", sellerId: p.sellerId, amount: amt }, { account: "PAYOUTS_CLEARING", amount: -amt }],
  });
}

/** ADJUSTMENT journal for a manual SellerTransaction (+ increases what we owe the seller). */
export async function postAdjustment(sellerTransactionId: string) {
  const t = await db.sellerTransaction.findUnique({ where: { id: sellerTransactionId } });
  if (!t || t.type !== "ADJUSTMENT") return null;
  const amt = toMinor(t.amount);
  return postJournal({
    kind: "ADJUSTMENT", refType: "SELLER_TX", refId: t.id, note: t.note ?? "Manual adjustment",
    lines: [{ account: "SELLER_PAYABLE", sellerId: t.sellerId, amount: -amt }, { account: "ADJUSTMENTS", amount: amt }],
  });
}

/** PROVIDER_FEE: fee deducted by the payment provider. `idempotencyKey` stops a double-clicked form posting twice. */
export async function postProviderFee(input: { amount: number; note?: string; idempotencyKey: string }) {
  const amt = toMinor(input.amount);
  if (amt <= 0) throw new LedgerError("Fee must be greater than zero");
  return postJournal({
    kind: "PROVIDER_FEE", refType: "MANUAL", refId: input.idempotencyKey, note: input.note ?? "Payment provider fee",
    lines: [{ account: "PROVIDER_FEES", amount: amt }, { account: "CASH_CLEARING", amount: -amt }],
  });
}

/** Correcting entry: a NEW journal that exactly negates an earlier one. Originals are never edited. One reversal per transaction. */
export async function reverseTransaction(transactionId: string, reason: string) {
  const tx = await db.ledgerTransaction.findUnique({ where: { id: transactionId }, include: { lines: true } });
  if (!tx) throw new LedgerError("Transaction not found");
  if (tx.kind === "REVERSAL") throw new LedgerError("A reversal can't be reversed — post a new adjustment instead");
  return postJournal({
    kind: "REVERSAL", refType: "LEDGER_TX", refId: tx.id, currency: tx.currency,
    note: `Reversal of ${tx.kind} ${tx.refType}:${tx.refId} — ${reason}`,
    lines: tx.lines.map((l) => ({ account: l.account as JournalLine["account"], sellerId: l.sellerId, amount: -l.amount, memo: l.memo ?? undefined })),
  });
}

// ───────────────────────── Safe wrappers: ledger problems must never block the order flow ─────────────────────────
async function fail(orderId: string | null, what: string, e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`[ledger] ${what}: ${msg}`);
  if (orderId) await orderEvent(orderId, "ledger_error", `LEDGER_ERROR (${what}): ${msg}`).catch(() => null);
}
export async function postOrderPaidSafe(orderId: string) {
  try { await postOrderPaid(orderId); } catch (e) { await fail(orderId, "order paid", e); }
}
export async function postRefundSafe(refundId: string, orderId: string) {
  try { await postRefund(refundId); } catch (e) { await fail(orderId, "refund", e); }
}
export async function postPayoutSafe(payoutId: string) {
  try { await postPayout(payoutId); } catch (e) { await fail(null, `payout ${payoutId}`, e); }
}
export async function postAdjustmentSafe(sellerTransactionId: string) {
  try { await postAdjustment(sellerTransactionId); } catch (e) { await fail(null, `adjustment ${sellerTransactionId}`, e); }
}

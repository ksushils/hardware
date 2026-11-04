import "server-only";
import type { LedgerTransaction, LedgerLine } from "@prisma/client";
import { db } from "./db";

/**
 * Double-entry ledger core. Amounts are signed integers in minor units (fils): debit = +, credit = −.
 * Every transaction must sum to zero. History is IMMUTABLE: this module deliberately exposes NO update or delete.
 * Corrections are made by posting a new, reversing journal (see reverseTransaction in ledgerPosting.ts).
 * (DB-level triggers in scripts/apply-ledger-triggers.ts enforce this even for raw SQL.)
 */
export const ACCOUNTS = {
  CASH_CLEARING: "Cash received from customers / returned (clearing)",
  GIFT_CARD_LIABILITY: "Gift-card balances redeemed against orders",
  DISCOUNTS: "Store-funded discounts (contra-revenue)",
  SALES_REVENUE: "Store sales and Care+ revenue (ex-VAT)",
  SHIPPING_REVENUE: "Store delivery and COD-fee revenue (ex-VAT)",
  PLATFORM_COMMISSION: "Marketplace commission earned (ex-VAT)",
  VAT_PAYABLE: "VAT collected on store sales, shipping and commission",
  SELLER_PAYABLE: "Owed to sellers (per seller)",
  PAYOUTS_CLEARING: "Seller payouts sent (clearing)",
  PROVIDER_FEES: "Payment-provider fees (expense)",
  REFUNDS: "Reserved for refund cost reporting",
  ADJUSTMENTS: "Manual adjustments (P&L)",
  ROUNDING: "Sub-fil rounding differences (≤ 5 fils per order)",
} as const;
export type Account = keyof typeof ACCOUNTS;

export type JournalLine = { account: Account; amount: number; sellerId?: string | null; memo?: string };
export type JournalInput = { kind: string; refType: string; refId: string; note?: string; currency?: string; lines: JournalLine[] };
export type PostedJournal = LedgerTransaction & { lines: LedgerLine[] };

export class LedgerError extends Error {}

/** Throws unless the lines are valid integers, non-empty, reference known accounts and sum to exactly zero. */
export function assertBalanced(lines: JournalLine[]) {
  if (!lines.length) throw new LedgerError("Journal has no lines");
  let sum = 0;
  for (const l of lines) {
    if (!Number.isInteger(l.amount)) throw new LedgerError(`Non-integer amount on ${l.account}: ${l.amount}`);
    if (!(l.account in ACCOUNTS)) throw new LedgerError(`Unknown account ${l.account}`);
    if (l.account === "SELLER_PAYABLE" && !l.sellerId) throw new LedgerError("SELLER_PAYABLE lines need a sellerId");
    sum += l.amount;
  }
  if (sum !== 0) throw new LedgerError(`Unbalanced journal: debits − credits = ${sum}`);
}

/**
 * Posts a balanced journal atomically. Idempotent on (kind, refType, refId): posting the same reference again
 * returns the existing transaction untouched (never a duplicate, never a modification).
 */
export async function postJournal(input: JournalInput): Promise<PostedJournal> {
  const lines = input.lines.filter((l) => l.amount !== 0);
  assertBalanced(lines);
  if (lines.length < 2) throw new LedgerError("A journal needs at least two non-zero lines");
  const key = { kind: input.kind, refType: input.refType, refId: input.refId };
  const existing = await db.ledgerTransaction.findUnique({ where: { kind_refType_refId: key }, include: { lines: true } });
  if (existing) return existing;
  try {
    return await db.ledgerTransaction.create({
      data: {
        ...key, note: input.note, currency: input.currency ?? "AED",
        lines: { create: lines.map((l) => ({ account: l.account, sellerId: l.sellerId ?? null, amount: l.amount, memo: l.memo })) },
      },
      include: { lines: true },
    });
  } catch (e) {
    // concurrent post of the same reference: the unique index won, return the winner
    const again = await db.ledgerTransaction.findUnique({ where: { kind_refType_refId: key }, include: { lines: true } });
    if (again) return again;
    throw e;
  }
}

export async function getJournal(kind: string, refType: string, refId: string) {
  return db.ledgerTransaction.findUnique({ where: { kind_refType_refId: { kind, refType, refId } }, include: { lines: true } });
}

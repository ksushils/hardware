# Finance: ledger, statements and reconciliation

The marketplace keeps an **append-only, double-entry ledger** in integer minor units (AED fils). It sits beside the existing seller balance records (`SellerTransaction` / `Payout`), which still drive what a seller can withdraw and when. The ledger is the auditable record of where every dirham went; the reconciliation report proves the two agree.

> **Decisions for the business owner (not made by the software):** the platform is modelled as the **merchant of record that collects customer payments** and owes sellers their share. Whether that is legally permitted for your licence, how seller VAT is handled, and whether funds may be held for sellers are questions for your legal/tax adviser. Held seller funds are **not** described as "escrow" anywhere in the product, and shouldn't be unless a legally approved escrow arrangement exists.

## Files
| Path | Purpose |
|---|---|
| `src/lib/money.ts` | Currency exponents, `toMinor`/`fromMinor`, round-half-away-from-zero, `allocate()` (largest remainder) |
| `src/lib/ledger.ts` | `postJournal()` (validated, atomic, idempotent). No update/delete API |
| `src/lib/ledgerPosting.ts` | The journals below + safe wrappers used by the order flow |
| `src/lib/ledgerReports.ts` | Trial balance, month summary, reconciliation, seller statements, formula-safe CSV |
| `scripts/apply-ledger-triggers.ts` | DB triggers making the ledger tables immutable |
| `scripts/ledger-backfill.ts` | Posts journals for everything already paid (idempotent) |
| `src/app/admin/finance/**` | Admin: overview, explorer, reconciliation, provider fees, exports |
| `src/app/seller/statements/**` | Seller monthly statements (own data only) |

## Conventions
* Amounts are **signed integers in minor units**: debit **+**, credit **−**. Every transaction sums to **0**.
* `LedgerTransaction` is unique on `(kind, refType, refId)`, so posting the same thing twice returns the original. This is what makes retries, double clicks, webhooks and re-runs of the backfill safe.
* Currency exponents: AED/SAR/QAR = 2, KWD/BHD/OMR = 3 (`CURRENCIES` in `money.ts`). The rest of the app still stores AED as 2-dp floats; conversion to minor units happens only at the ledger boundary.
* Months in statements and reports are **Dubai time (UTC+4)**.

## Chart of accounts
| Account | Meaning | Normal side |
|---|---|---|
| `CASH_CLEARING` | Money received from customers (and returned). Reconcile to the payment provider's settlement | Dr |
| `GIFT_CARD_LIABILITY` | Gift-card value redeemed against orders | Dr when redeemed |
| `DISCOUNTS` | Store-funded discounts (contra-revenue) | Dr |
| `SALES_REVENUE` | Store-owned items and Care+ warranty, **ex-VAT** | Cr |
| `SHIPPING_REVENUE` | Store-fulfilled delivery fees and the COD fee, **ex-VAT** | Cr |
| `PLATFORM_COMMISSION` | Marketplace commission earned, **ex-VAT** | Cr |
| `VAT_PAYABLE` | VAT collected on the three revenue accounts above | Cr |
| `SELLER_PAYABLE` (per seller) | What the platform owes a seller | Cr |
| `PAYOUTS_CLEARING` | Money sent to sellers' banks | Cr |
| `PROVIDER_FEES` | Payment-provider fees | Dr |
| `ADJUSTMENTS` | Manual seller balance adjustments (P&L) | either |
| `ROUNDING` | ≤ 5 fils of rounding per order | either |
| `REFUNDS` | Reserved for refund-cost reporting (unused today) | – |

## Journals

### `ORDER_PAID` (ref: order id) — posted when payment is received
Cards/Stripe/gift-card orders: when `markOrderPaid` runs. **COD**: when the order is delivered and cash collected (admin "Mark delivered" or the seller marking the last sub-order delivered).
```
Dr CASH_CLEARING         Order.total                 (cash actually received)
Dr GIFT_CARD_LIABILITY   Order.giftCardAmount
Dr DISCOUNTS             Order.discount              (all discounts are treated as store-funded)
  Cr SELLER_PAYABLE[s]   Σ(price×qty − commission) for seller s's items  +  seller s's delivery fee
  Cr PLATFORM_COMMISSION Σ commission, ex-VAT
  Cr SALES_REVENUE       store-owned items + Care+ warranty, ex-VAT
  Cr SHIPPING_REVENUE    (Order.shipping − seller delivery fees) + COD fee, ex-VAT
  Cr VAT_PAYABLE         VAT on the commission, sales and shipping-revenue lines
```
Total debits = `subtotal + shipping + codFee` (the full gross), which is also the total of the credits.

### `REFUND` (ref: refund id)
Reverses the order's `ORDER_PAID` journal **pro rata to refund ÷ order total**: cash goes out, and seller payable, commission, revenue and VAT are reversed in proportion. A full refund fully reverses everything, including the seller's share. The gift-card and discount debit lines are reversed pro rata too.
> Limitation: the app does not restore a gift-card *balance* on a refund (existing behaviour); the ledger reverses the liability so the books show the obligation, but the `GiftCard` row is unchanged.

### `PAYOUT` (ref: payout id) — when an admin marks it **paid**
`Dr SELLER_PAYABLE[s]`, `Cr PAYOUTS_CLEARING`.

### `ADJUSTMENT` (ref: seller transaction id) — manual balance adjustment
`+X` (we owe the seller more): `Cr SELLER_PAYABLE`, `Dr ADJUSTMENTS`. `−X` the reverse.

### `PROVIDER_FEE` (ref: idempotency key) — Admin → Finance → Provider fees
`Dr PROVIDER_FEES`, `Cr CASH_CLEARING`. A per-form key makes a double-clicked submit post once.

### `REVERSAL` (ref: the original transaction id)
A correcting entry that exactly negates an earlier journal (Admin → Finance → Ledger → entry → *Post correcting entry*). One reversal per transaction; a reversal can't be reversed. Originals are never touched.

## Rounding and allocation
* Every product, shipping and commission amount is converted with `toMinor()` (round half away from zero; float noise such as `0.1+0.2` is stripped first).
* VAT is extracted **per component**: `net = round(gross ÷ 1.05)`, `vat = gross − net`, so `net + vat = gross` exactly.
* Refund reversals use `allocate()`: the largest-remainder method guarantees the parts sum to the total to the last fil.
* If the order's own totals disagree with the items by up to **5 fils** the difference goes to `ROUNDING`. Beyond that the order is **not posted**: a `ledger_error` event is added to its timeline and it appears under *Paid orders without a ledger entry* in reconciliation. Ledger problems never block checkout, refunds or payouts.

## Tax assumptions (confirm with your accountant)
* All customer prices are VAT-inclusive at the rate in Settings → Taxes (default 5%).
* VAT is recorded for the **platform's own supplies**: store-owned goods, Care+, store delivery/COD fees and **marketplace commission** (treated as a taxable service, commission amounts are VAT-inclusive).
* The seller's VAT on the goods they sell is **their** responsibility. Seller payable and statements are VAT-inclusive as charged to the customer.
* Seller-funded promotions are not modelled; discounts are assumed to be funded by the store, so sellers are unaffected.

## Hold period
Sellers can only withdraw earnings after delivery plus the hold in `settings.marketplace.holdDays`. This is handled by `SellerTransaction.availableAt`. The ledger accrues the seller's share at **payment**, so *Owed to sellers* in Finance includes earnings still in the hold. The seller's delivery fee is credited to their withdrawable balance together with the earning (`creditSellerEarnings`).

## Reconciliation procedure (Admin → Finance → Reconciliation)
Run daily and before every payout batch. All of these should say **OK**:
1. **Paid orders without a ledger entry**: click *Post now* (idempotent). If it keeps failing, open the order timeline for `LEDGER_ERROR` and correct the order data.
2. **Ledger cash vs order total − refunds**: any difference means a payment/refund was altered outside the normal flow. Investigate in the ledger explorer, then fix with a correcting entry.
3. **Paid payouts without a ledger entry**: *Post now*.
4. **Seller balances**: *Ledger vs sources* must be a ✓ (error if not). *Seller-balance engine vs ledger* may show review items: the two engines split refunds slightly differently (merchandise share vs order-total share).
5. **Unbalanced transactions**: must be empty. The page and the Finance overview turn red if the trial balance isn't zero. Stop payouts until resolved.
6. Compare `CASH_CLEARING` to your payment provider's settlement report, and `PAYOUTS_CLEARING` to bank transfers sent.

## Immutability
Three layers: (1) `ledger.ts` exposes no update/delete; (2) the UI only offers correcting entries; (3) **database triggers** reject `UPDATE`/`DELETE` even from raw SQL:
```bash
npx tsx scripts/apply-ledger-triggers.ts     # idempotent; run after every `prisma db push` / deploy
```
The demo seed wipes tables, so it must drop the triggers first (`dropLedgerTriggers(db)` is exported from that script for development use only).

PostgreSQL equivalent (when you switch the provider):
```sql
CREATE OR REPLACE FUNCTION ledger_immutable() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'ledger is immutable: post a reversing journal instead'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER ledger_line_immutable BEFORE UPDATE OR DELETE ON "LedgerLine"        FOR EACH ROW EXECUTE FUNCTION ledger_immutable();
CREATE TRIGGER ledger_tx_immutable   BEFORE UPDATE OR DELETE ON "LedgerTransaction" FOR EACH ROW EXECUTE FUNCTION ledger_immutable();

-- Recommended on Postgres: reject unbalanced transactions at commit time
CREATE OR REPLACE FUNCTION ledger_check_balance() RETURNS trigger AS $$
BEGIN
  IF (SELECT SUM("amount") FROM "LedgerLine" WHERE "transactionId" = NEW."transactionId") <> 0 THEN
    RAISE EXCEPTION 'unbalanced ledger transaction %', NEW."transactionId";
  END IF; RETURN NULL;
END; $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER ledger_balanced AFTER INSERT ON "LedgerLine" DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION ledger_check_balance();
```

## Operations checklist
```bash
npx prisma db push
npx tsx scripts/apply-ledger-triggers.ts
npx tsx scripts/ledger-backfill.ts          # exits non-zero if the books don't balance afterwards
```
* Seller statements: Seller portal → Statements (monthly, printable, CSV); admins open the same statement from the seller page.
* All CSV downloads neutralise leading `= + - @` in text cells (formula injection); numbers are written as numbers.
* Access: finance pages and exports require the **sellers** permission; a seller's statement and CSV always use the logged-in seller's id, never an id from the URL.

## Known limitations / future work
* Money elsewhere in the app is still `Float` (AED, 2 dp). Only the ledger is integer-based.
* One currency (AED) is live; the helpers already support 3-decimal currencies.
* No automated provider settlement import; reconcile `CASH_CLEARING` manually against the provider report.
* Provider fees are entered by hand (no per-transaction fee capture).
* Chargebacks and disputes should be posted as a `REFUND`-style adjustment manually until a provider integration exists.
* Gift-card restore on refund is not automated (see above).

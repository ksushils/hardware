# Support & dispute cases (marketplace phase 4)

One connected case system for **buyer ↔ seller ↔ Karat support**, including warranty claims. Code: `src/lib/cases.ts` (rules), `src/lib/caseLabels.ts` (pure labels/helpers),
`src/app/actions/cases.ts` + `src/app/actions/admin/cases.ts` (server actions), `src/components/cases/**` (UI), `src/app/api/cron/cases/route.ts` (SLA cron).

## Where things live
| Who | URL | Notes |
|---|---|---|
| Buyer (signed in) | `/account/cases`, `/account/cases/new`, `/account/cases/[number]` | "Report a problem" link on every order line |
| Buyer (guest) | `/cases/new?order=…&k=…`, `/cases/[number]?k=…` | Signed keys from emails (`caseAccessKey`). Lives outside `/account` because the account layout forces sign-in |
| Seller | `/seller/cases`, `/seller/cases/[number]` | Scoped by `sellerId`; approved sellers only |
| Karat staff | `/admin/cases`, `/admin/cases/[number]` | Needs the `orders` permission |

## Workflow
1. Buyer opens a case against an order line (optionally a quantity, for partial-quantity disputes) with a reason, the resolution they want and evidence files.
   Cases that aren't about an order are only possible for `PRIVACY`, `OTHER`, `SELLER_CONDUCT` and `PAYMENT`.
2. The case copies the **terms the buyer agreed to at checkout** (`OrderItem` snapshots: seller, condition, warranty, returns) into `SupportCase.policySnapshot`.
   Older orders without snapshots fall back to the store defaults and are labelled "Older order". Later seller edits never change a case.
3. Routing: normal cases → `AWAITING_SELLER` (seller has **2 working days**); `SAFETY` → `ESCALATED` immediately; `PRIVACY`, `PAYMENT`, `SELLER_CONDUCT` → `IN_REVIEW`
   and **the seller is not given the case** (the seller id is kept only inside the snapshot for staff).
4. Seller replies (→ `AWAITING_BUYER`), asks for evidence, or **proposes** a resolution (full/partial refund, replacement, repair, return). Staff can also propose or ask either side questions.
5. Buyer **accepts** (→ `IN_REVIEW`, awaiting Karat to execute) or **declines** with a reason (→ `ESCALATED`). The buyer can also escalate at any time, or withdraw.
6. Staff **decide and execute**: refund / partial refund, replacement, repair, return, or decline (a plain-language explanation is mandatory and shown to the buyer and seller).
   Money never moves on a buyer's click: only staff execute refunds.
7. Resolved cases can be **reopened by the buyer within 14 days** (with a reason) and by staff at any time.

### Statuses
`OPEN`, `AWAITING_SELLER`, `AWAITING_BUYER`, `IN_REVIEW`, `PROPOSED`, `ESCALATED`, `RESOLVED`, `CLOSED`. Allowed moves are in `canTransition()` (`cases.ts`).

## Refunds (cannot exceed the refundable value)
`refundCap(caseId)` = `min(order total − already refunded, item value × affected quantity − already refunded through this case)`.
Both proposals and decisions are checked against it; `performRefund` (the existing order refund flow: payment provider, order totals, ledger) enforces the order-level limit again.
After a refund `applySellerRefund(orderId, amount, sellerId)` charges **only the seller who sold the item** back, against their own sub-order (`earningRatio × amount`),
and only if their earnings were already credited. `applySellerRefund`'s new third argument is optional: the old order-wide refund still splits proportionally across all sellers.

## SLA & escalation
- Seller deadline = 2 **working days** (Mon–Fri; `WORKING_DAYS` in `cases.ts`). Escalation time = deadline + 2 working days.
- `escalateOverdueCases()` moves `AWAITING_SELLER` cases past their escalation time to `ESCALATED`, adds a system message and emails staff, buyer and seller.
- Cron: `GET|POST /api/cron/cases` with `Authorization: Bearer $CRON_SECRET` (403 if `CRON_SECRET` is unset or wrong). Suggested crontab: `*/30 * * * *`.
- Admin list shows SLA badges ("Response due in 1d 4h", "Overdue by 5h", "Escalated") and has an *Overdue / escalated* filter.

## Warranty claims
Type `WARRANTY`. Warranty remaining is computed from the **snapshot** (`months` from delivery, else order date) and shown to staff, the seller and the buyer (informational only; it never blocks a case).
Repair/replacement progress (`RECEIVED → DIAGNOSING → REPAIRING → SHIPPED_BACK`, or `REPLACED`) is updated by the seller or staff and shown to the buyer as a tracker.
A final `SHIPPED_BACK`/`REPLACED` moves an `AWAITING_SELLER` case to `IN_REVIEW` for staff to close.

## Privacy & security
- **Internal notes** (`CaseMessage.internal = true`) can only be created by staff. Every buyer/seller reader (`getCaseForBuyer`, `getCaseForSeller`) filters `internal: false`; only `getCaseForStaff` returns them.
- **Sellers** only load cases with their `sellerId`, through an explicit `select` that omits the buyer's email, user id and assignee; they see the buyer's name and emirate only. Another seller's case is "not found".
- **Buyers** reach a case by owning it or by the signed key in an emailed link (HMAC of the case number with `AUTH_SECRET`).
- **Attachments** are private files (`savePrivateFile`, content-sniffed PDF/PNG/JPG/WebP, ≤10MB, ≤5 per message, stored outside `/public`). Pages render **short-lived signed links** to `/api/files/<id>`
  (15 minutes) and only for files owned by that case. `/api/files` itself re-checks the viewer (buyer, involved seller, permitted staff).
- Rate limits: 10 new cases/hour and 30 messages/hour per IP.
- Email failures never break a case action (logged to `EmailLog` when no Resend key is set).

## Assumptions / not done
- The "statutory rights are never auto-denied" rule is enforced by design: eligibility hints are informational and creation is never blocked by return/warranty windows.
- Accepted refund proposals are **not** auto-executed; staff run them (money safety). An accepted proposal pre-fills the staff decision form.
- Return decisions create an *approved* `ReturnRequest`; collection/inspection continues in the existing Returns screens.
- Case emails to the buyer are bilingual (order/user locale); case *messages* and server error strings are English.
- Seller-side "case reminders" before the deadline are not sent (only the escalation notice).
- Messages are not malware-scanned (type and size checks plus content sniffing only).

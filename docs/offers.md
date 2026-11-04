# Offers model: canonical products with multiple seller offers

## Model
- **Product** = the canonical product page (title, specs, images, options). One page per real-world product.
- **Variant = the sellable OFFER.** A canonical product can have many variants from different sellers, each with its own price, stock, condition, evidence and terms.
  - `Variant.sellerId` is `null` for the store's own offers; otherwise the selling shop.
  - `Product.sellerId` only records who *created* the product record. It has no effect on who can sell it.
- The option values (e.g. Condition = Excellent, Capacity = 2TB) define the *specification*. Several offers can share the same specification; the buyer then chooses between them.

### Offer fields (on `Variant`)
`approvalStatus` (DRAFT · PENDING · APPROVED · REJECTED), `rejectionReason`, `conditionType` (NEW · OPEN_BOX · REFURBISHED · USED · PARTS), `cosmeticGrade`, `functionalStatus`, `batteryHealth`, `batteryCycles`, `repairDisclosure`, `accessories`, `verification` (NONE · SELLER_DECLARED · PLATFORM_VERIFIED), `testedAt`, `testedBy`, `testNotes`, `photos` (JSON, photos of the exact unit), `warrantyProvider` (SELLER · MANUFACTURER · KARAT · NONE), `warrantyMonths`, `warrantyTerms`, `returnDays`, `returnTerms`, `handlingDays`.

Legacy/store variants without these fields still work: the commercial condition is derived from the product's "Condition" option (Brand New → NEW, anything else → REFURBISHED) and missing evidence is shown as *Not supplied*.

## Visibility rules (`src/lib/offers.ts`, `src/lib/catalog.ts`)
An offer is **listed** when: the offer is `APPROVED`, its product is `ACTIVE` and `APPROVED`, and its seller is `null` (store) or `APPROVED` and not on vacation (vacation ends automatically after `vacationUntil`). It is **visible/buyable** when it is also in stock.
- Search, categories, collections, wishlist, compare, PC builder, trade-in, seller shops and the product page only use listed offers; a product with no listed offer disappears.
- "From" prices and "x% vs new" use listed offers only.
- `addEntry` / `getCartDetails` re-check variant-level approval and the *variant's* seller, so a suspended seller's offers cannot be added to the cart or stay in it.

## Recommended-offer ranking (transparent, published at `/grading#ranking`)
Score out of 100 among offers of the **same specification**; sold-out offers are never recommended.

| Factor | Max | Rule |
|---|---|---|
| Price | 40 | cheapest offer = full points; others scale by cheapest ÷ price |
| Condition | 20 | NEW 18 · OPEN_BOX 15 · REFURBISHED 13 · USED 8 · PARTS 0, +2/+1/0 for Excellent/Very good/Good |
| Warranty | 15 | months ÷ 24 (capped); "No warranty" = 0 |
| Seller rating | 10 | rating ÷ 5 (needs ≥ 3 ratings, else neutral 5); store-direct = 8 |
| Dispatch | 10 | 10 − 2 × handling days |
| Evidence | 5 | verified 5 · seller-declared 2 · none 0 |

`rankOffers()` returns the score, per-factor points and *reasons* ("Lowest price", "Longest warranty", …) shown as "Recommended because…". No sponsored placement exists; if added it must be labelled and separate.
Assumption: shipping is not part of the price factor because it depends on the buyer's address (shown at checkout).

## Evidence labels
Every condition data point is labelled by who stands behind it:
- **Verified by TechRevive**: only when `verification = PLATFORM_VERIFIED`, which staff can set only if evidence exists and a verifier name and date are recorded (`setOfferVerification`).
- **Seller-declared** (or *Declared by TechRevive (not independently verified)* for store offers).
- **Not supplied**: nothing recorded. Never filled with assumptions.
Sellers can only choose "declared"; editing evidence removes a platform verification.
Photos in `Variant.photos` are captioned "Photos of this exact unit"; used/refurbished offers without them show a notice that catalogue images may not match the unit.

## Approval flow
1. **Add offer to an existing product** (`/seller/products/offers/new`): seller picks the product + specification, fills condition/evidence/terms/photos/price/stock. New offers are `PENDING` unless `settings.marketplace.autoApproveProducts`.
2. **Create a new product** (`/seller/products/new`): the product and the creator's offers are `PENDING`; approving the product in *Admin → Marketplace → New products* also approves the creator's offers (rejecting rejects them).
3. Seller edits: price/stock apply instantly; changing condition, evidence, photos, warranty, returns, dispatch or the specification sends an approved offer back to `PENDING` (and clears platform verification).
4. Content of an approved product that others also sell is **locked** for the creator (only moderators edit canonical content).
5. Staff moderate offers at *Admin → Marketplace → Approvals → Seller offers* (bulk approve/reject with reason, emails to the seller, evidence + verification form). Requires permission `sellers`; actions are logged.
6. The admin product editor and the admin Excel import manage **store-owned offers only** (`sellerId = null`); they never edit or delete sellers' offers.

## Consumer-rights guards
- Return window: sellers may offer longer than `settings.returnsDays` but never shorter.
- Warranty provider is explicit; a seller warranty is never labelled as the manufacturer's.
- The terms shown at purchase are copied onto the order item (`src/lib/offerSnapshots.ts`, written by checkout) so later edits cannot reduce them.

## Not done / assumptions
- Serial/IMEI-level units, diagnostics attachments and data-erasure evidence are out of scope for this phase (photos + declared fields only).
- Bulk offer import is in the seller import module; this phase only covers the manual forms.
- Demo fixtures: `prisma/seedOffers.ts` (includes one fake "verified" offer, labelled `DEMO FIXTURE`; remove before launch).

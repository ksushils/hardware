# Per-seller shipments, checkout snapshots and seller bulk import

Status: implemented (software). Courier integrations, real carrier ETAs and payout of shipping fees are **not** part of this phase.

## 1. One cart, several shipments

A cart can contain items sold by the store and by marketplace sellers. They never ship as one parcel, so checkout, cart, order page and emails show **Shipment i of N · sold by X · delivery fee · arrives in A–B business days** and never a single delivery date.

**Who sells an item:** the offer (`Variant.sellerId`). `null` means the store. `Product.sellerId` is only the product's creator and is never used to attribute a sale (a store offer added to a seller-created product stays the store's).

| Shipment | Fee | ETA (business days) |
|---|---|---|
| Store parcel | The delivery rate the buyer picks (by emirate; express/same-day only if **every store-sold item** is express-eligible). Free above the rate's threshold, judged on the store group's value after its pro-rata share of any discount. | The rate's `deliveryDays` ("2-4", "1", "0" = same day). |
| Seller parcel | The seller's `flatShippingFee`, free when the seller group's value (before discounts) ≥ `freeShippingOver`. | `max(handlingDays of its items) + carrier window`. |

* **Carrier window** (UAE default **1–3 business days**) is `settings.delivery.carrierMinDays/MaxDays`, editable in Admin → Settings → Shipping & delivery. Example: handling 2 days → "3–5 business days".
* A `FREE_SHIPPING` discount zeroes every shipment fee. `Order.shipping` = sum of the shipment fees (COD fee stays separate in `codFee`).
* A cart with only seller items needs no store delivery rate (`rateId` is optional in that case).
* The browser shows a live preview using the same pure functions (`lib/shipmentMath.ts`, `computeTotals({ shipmentFees })`); the server recomputes everything from the database in `placeOrder` and ignores any client-side fee.
* Seller shipments are stored as `SellerOrder` rows with `shippingFee`, `etaMinDays`, `etaMaxDays`, tracking and status. The store parcel uses the order-level tracking fields; its ETA is looked up from the chosen delivery rate (matched by name) for display.

## 2. Offer snapshots on the order

When the order is placed each `OrderItem` stores `sellerId`, `sellerName` and three JSON snapshots written by `offerSnapshots()` (`lib/offerSnapshots.ts`): `conditionSnapshot` (condition type, grade, battery, verification, repairs, accessories), `warrantySnapshot` (provider, months, terms) and `returnSnapshot` (days, terms). Offer fields left empty fall back to the store defaults (`settings.warranty.months`, `settings.returnsDays`). Later edits to the offer never change what a buyer already bought; the order page shows "terms at time of purchase".

Commission is resolved for the **offer's seller** (seller override > product rule > seller rule > category rule > global rule > default) using the product's category, and snapshotted per line in `createSellerOrders`.

## 3. Offers hidden after being added to a cart

`resolveCheckoutCart()` (`lib/shipments.ts`) is used by the cart page, the checkout page and `placeOrder`. A line is blocked when its offer is not `APPROVED`, its product is not active/approved, its seller is not `APPROVED` or is on vacation, it sold out, or it was deleted. The cart shows a red notice with a Remove button and hides the checkout button; the checkout page redirects back to the cart; `placeOrder` refuses with the same message.

## 4. Stock integrity

`reserveStock()` (`lib/stock.ts`) takes stock inside the order transaction with `UPDATE … WHERE stock >= qty`. Two buyers racing for the last unit cannot both win: the loser's update affects 0 rows, the whole transaction rolls back and nothing is decremented or logged. Verified with three concurrent buyers (1 winner, 2 out-of-stock, stock 0, one adjustment). Reservation expiry for unpaid card orders is handled separately by the order-expiry cron.

## 5. Seller bulk import (`/seller/import`)

**Wizard:** download template → upload → column mapping → preview → confirm → result + history. Everything is scoped to the signed-in approved seller; a seller can only create and update their own offers.

**Files:** `.xlsx` or `.csv` (also `.txt`), max **10 MB** and **2,000 rows**, 60 columns, 2,000 characters per cell. CSV delimiter (`, ; tab |`) and encoding (UTF-8, UTF-8 BOM, UTF-16, **Windows-1256 Arabic**) are detected. `.xlsm/.xls/.xlsb`, macro workbooks, ZIP bombs, ZIP64, path-traversal entry names and files whose bytes don't match their extension are rejected **before** any decompression. Files are never written to disk.

**Template columns:** `seller_sku*`, `product_handle*`, `option1_value`, `option2_value`, `option3_value`, `condition_type*`, `cosmetic_grade`, `functional_status`, `battery_health_percent`, `battery_cycles`, `price*`, `quantity*`, `handling_days`, `warranty_provider`, `warranty_months`, `warranty_terms`, `return_days`, `return_terms`, `accessories`, `repair_disclosure`, `photo_urls`, `test_notes` (\* required). The workbook has an Instructions sheet and a Catalogue sheet (valid product handles and option values). A catalogue CSV and an export of the seller's current offers (same format, for bulk price/stock edits) are also available.

**Matching rules**
* A row is an **offer** on an existing, live catalogue product (`product_handle`). Unknown products are rejected with a pointer to *Products → New product* (moderation); products, categories and options are never created silently.
* Option values must be among the product's declared option values (case-insensitive); unknown values list the allowed ones.
* Offers are keyed by **(seller, SKU)**. `Variant.sku` is globally unique, so new SKUs are stored namespaced as `<shop-slug>:<seller_sku>`; existing offers match on the namespaced or the raw SKU. One SKU = one specification; a second offer for the same specification by the same seller is rejected.
* Rows whose SKU starts with `EXAMPLE-` (the template's sample rows) are rejected so they can't be imported by accident.

**Idempotency:** stock is **set** to the file's quantity, never added; every change is logged in the inventory adjustment log ("Seller bulk import"). Re-running the same file yields only "unchanged" rows and changes nothing. A per-seller lock row (`seller-import-lock:<sellerId>`, stale after 10 minutes) prevents overlapping runs.

**Moderation:** new offers, and any change to condition, grade, functional status, battery, repairs, accessories, photos, test notes, warranty or return terms, set `approvalStatus = PENDING` (unless `settings.marketplace.autoApproveProducts`). Price, stock and handling-time changes keep the current approval. A rejected offer that is corrected is resubmitted. Seller-supplied evidence is labelled `SELLER_DECLARED`; **only staff can set `PLATFORM_VERIFIED`**, and changing evidence on a verified offer removes the badge.

**Validation highlights:** price > 0, ≤ AED 1,000,000, ≤ 2 decimals (Arabic digits accepted); quantity 0–100,000; handling 0–30; battery 0–100; warranty 0–60 months; returns 0–90 days; sellers cannot assign the platform (`KARAT`) as warranty provider; `condition_type` ∈ NEW / OPEN_BOX / REFURBISHED / USED / PARTS (synonyms and Arabic terms accepted).

**Photo links (SSRF defence):** `https` only, no credentials, no custom ports, image extensions only (`.jpg .jpeg .png .webp .gif .avif`), max 10, and the host must not be `localhost`, a single-label name, `.local/.internal/…`, an IPv6 literal, or a private/loopback/link-local/CGNAT/metadata IPv4 address (including hex/decimal encodings). The links are **stored, never fetched** by this feature. If a later feature fetches or proxies photos it must re-resolve DNS and re-check the resolved address.

**Modes:** *Import valid rows only* (chunks of 200 rows, bad rows skipped and reported) or *All or nothing* (aborts before writing if any row has an error and runs as a single transaction). The confirm step **re-validates against the current database**; it never trusts the earlier preview.

**Reports:** a row-level error report CSV (row, SKU, handle, problem) with formula-injection protection (cells starting `= + - @` get a leading `'`). Import runs are logged for provenance (`seller-import-log:<seller>:<time>`, who/when/file/counts) and shown as history.

**Storage:** uploads are parsed once and kept server-side as a draft (1 hour) in the `Setting` table (`seller-import-draft:<seller>:<token>`); the column mapping is remembered per seller (`seller-import-map:<seller>`). No queue infrastructure exists, so heavy work is synchronous but chunked.

## Known limits / not done
* No real courier ETAs: delivery windows are configured estimates.
* Seller shipping fees are charged to the buyer and recorded on the shipment; settlement of those fees to sellers belongs to the ledger work.
* ZIP image uploads, SFTP feeds and an inventory API are not implemented.
* Variant `sku` stays globally unique in the schema, hence the `<slug>:` namespace.

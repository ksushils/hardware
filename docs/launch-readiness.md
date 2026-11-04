# Launch readiness

Status of each launch gate from the Karat marketplace specification. **Software built is not the same as business authorised to launch.**
Statuses: ✅ implemented and tested · 🟡 implemented, external verification pending · 🔑 blocked by credentials · 📄 blocked by contract/legal · ⬜ not implemented · ⏸ deferred

## Software (what the code does today)
| Area | Status | Notes |
|---|---|---|
| Canonical products with several seller offers, offer comparison, transparent ranking | ✅ | `docs/offers.md`; browser-tested |
| Condition, battery, repairs, accessories, unit photos; "seller-declared / verified / not supplied" labels | ✅ | Staff-only "Verified by TechRevive" requires evidence, verifier and date |
| Per-offer warranty and returns, snapshotted on every order line | ✅ | A later seller edit never changes what the buyer agreed to |
| Per-seller shipments with own fee and ETA; no single date for separate parcels | ✅ | ETAs are configured estimates, not live courier data |
| Seller bulk import (CSV/XLSX), idempotent, row-level errors, injection and SSRF guards | ✅ | `docs/shipments-and-import.md`; no ZIP images, SFTP or API |
| Support and dispute cases, warranty claims, SLA escalation, private internal notes | ✅ | `docs/support-cases.md`; accepted refunds are executed by staff, not automatically |
| Double-entry ledger (integer minor units, immutable), reconciliation, seller statements | ✅ | `docs/finance.md` |
| Private document storage with authorised access / signed links | ✅ | Licences and case evidence; migration for older public files |
| Rate limiting, security headers, verified-buyer reviews, unpaid-order expiry | ✅ | In-memory limiter: fine for one server process |
| Automated tests and CI | 🟡 | 28 unit/integration tests; CI workflow added. Browser journeys are scripts, not yet part of CI |
| Arabic UI (storefront, seller sign-up, cases) | 🟡 | Strings need professional review before launch. Admin and seller portal are English |
| Money outside the ledger is stored as decimals (rounded to 2 dp) | ⏸ | Ledger uses integers; converting the whole app is a separate refactor |
| Multi-country (SAR, KWD …), serial/IMEI units, SFTP/ERP feeds, AI features, protection plans | ⏸ | Not built; UAE only |
| Two-factor login for admins and seller owners | ⬜ | Recommended before real sellers onboard |
| Seller staff roles (several users per seller) | ⬜ | One login per seller today |

## Business and external gates (need you)
| Gate | Status |
|---|---|
| Legal entity and operating model decided (merchant of record: does TechRevive collect customers' money and pay sellers?) | 📄 |
| Seller agreement, consumer policies, Terms/Privacy reviewed by a UAE adviser (PDPL, consumer protection, used-goods disclosure) | 📄 |
| Payment-provider **marketplace** account (Tap, PayTabs or Stripe Connect where eligible) and tested refunds/reconciliation | 🔑 📄 |
| Courier account and tested shipping/return pickup (Aramex, DHL …) | 🔑 📄 |
| Tax and invoice configuration confirmed (TRN set; VAT on commissions) | 📄 |
| Approved grading and quality standard before showing "Verified" or similar badges | 📄 |
| English/Arabic consumer content approved | 📄 |
| Real sellers and validated inventory (remove demo sellers, demo offers and demo products) | ⬜ |
| Staffed support and escalation; repair/return process documented | ⬜ |
| Backup restore rehearsed; monitoring and incident owner named; rollback rehearsed | ⬜ |
| Owner's go-live authorisation | ⬜ |

## Things that are deliberately still in "test mode"
- **Demo card page** (test cards, no real money) is ON while no Stripe key is set. Set `DISABLE_DEMO_PAYMENTS=1` (or connect Stripe) before real trading.
- **Demo data**: 36 demo products, 3 demo seller shops, 9 demo seller offers (one is a fake "verified" fixture), demo discount codes, and the demo accounts below. Remove them before launch.
- **Demo accounts** with known passwords exist wherever the seed was run (`staff@techrevive.ae`, `seller1@example.com`, `seller2@example.com`, `applicant@example.com`). Disable them on any server that is reachable by customers.

## Marketing claims to verify before launch
The default texts say things like "12-month warranty", "14-day returns", "tested and graded" and describe a Dubai test lab (About page). They are placeholders. Only publish what you actually do and have approved; edit them in Admin → Content / Settings.

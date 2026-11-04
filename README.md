# TechRevive UAE: Marketplace for PC Hardware

A complete, bilingual (English / Arabic RTL) e-commerce marketplace for **certified renewed and new PC hardware in the UAE**. It's inspired by revibe.me, has a Shopify-style admin and Webkul-style multi-vendor selling.

**Stack:** Next.js 15 (App Router, Server Actions) · TypeScript · Tailwind · Prisma (SQLite dev → Postgres prod) · Stripe · ExcelJS

## Quick start

```bash
npm install
cp .env.example .env        # set AUTH_SECRET
npm run setup               # create DB + seed demo data
npm run dev                 # http://localhost:3000
```

| Role | Login | Where |
|---|---|---|
| Store owner (all permissions) | `admin@techrevive.ae` / `admin12345` | `/admin` |
| Staff (orders + products only) | `staff@techrevive.ae` / `staff12345` | `/admin` |
| Marketplace seller | `seller1@example.com` / `seller12345` | `/seller` |

Demo codes: `WELCOME10`, `UAE50`, `BUILD75`, `FREESHIP` · gift card `GIFT-DEMO-0100` · demo card `4242 4242 4242 4242` (decline: `4000 0000 0000 0002`).

## Storefront
- **Arabic and English** with full RTL layout and an Arabic font. Switch with `?lang=ar` or the header toggle. Products, categories, collections, pages, blog and settings all have Arabic fields.
- **Homepage background video** (an original looping animation in `public/video`, replaceable in Admin → Settings → Theme). It respects reduced-motion settings and has a pause button.
- **Revibe-style filters:** condition, every variant option (capacity, colour…), searchable brand list, category, price range and presets, in stock, rating. Facet counts update live, active filters show as chips, mobile gets a filter drawer, and URLs are shareable.
- **Live search** with product previews, prices and discounts.
- **Products:**
  - Up to 3 options with a variant matrix and per-variant images.
  - "-X% vs new" is compared against the matching new variant.
  - Pay-in-4 messaging, Care+ extended warranty, an "order within Xh for delivery tomorrow" countdown, honest low-stock and "sold this week" badges, and a sticky add-to-cart bar.
  - Image gallery with zoom, reviews with store replies, product Q&A, back-in-stock alerts, compare, recently viewed.
- **PC Builder** (`/build`): checks socket, DDR type, cooler socket support, case form factor and PSU wattage headroom; shows savings vs new; shareable link; adds the whole build to the cart.
- **Trade-in estimator** (`/trade-in`): instant cash or store-credit (+10%) estimate and collection booking.
- **Cart and checkout:**
  - Guest or account checkout, saved addresses, shipping rates by emirate (standard, express next-day, same-day Dubai).
  - Discount codes plus automatic discounts, gift cards, cash on delivery with fee and limit, Stripe or the demo gateway.
  - "Save for later", abandoned-checkout capture and a recovery link.
- **Accounts:** profile and language, password reset, orders with tracking, returns (RMA), addresses, a wishlist with **move to cart / move all**, newsletter.
- **Content:** CMS pages, blog with RSS, help center with FAQ.
- **SEO:**
  - `sitemap.xml` with Arabic alternates, `robots.txt`, canonical URLs, Open Graph.
  - JSON-LD structured data: Organization, WebSite search, Product/Offer (refurbished vs new condition), AggregateRating, BreadcrumbList, BlogPosting, FAQPage, Store.
  - Per-item SEO fields and Shopify-style **URL redirects**.
- WhatsApp chat button and UAE details throughout: AED, 5% VAT included, the 7 emirates, UAE phone validation, TRN on tax invoices.

## Admin (Shopify-style, `/admin`)
- **Orders:**
  - List: tabs, filters, bulk actions, CSV export.
  - Detail: fulfil with tracking, mark delivered or paid, partial or full refunds with restock (refunded through Stripe when paid by Stripe), cancel, notes, tags, timeline.
  - Printable **UAE tax invoice** and packing slip.
  - Also: **draft orders** with emailed pay-links, **abandoned checkouts** with recovery emails, **returns**, **trade-ins**.
- **Products:**
  - Editor: English/Arabic content, media library, options and variants (price, compare-at, cost and margin, SKU, barcode, stock, weight, inventory policy), SEO, duplicate.
  - List: bulk actions.
  - Also: **collections** (manual and smart rules), **inventory** with an adjustment log, **gift cards**, **review moderation**, **Q&A**.
  - **Bulk import/export from Excel (.xlsx) and CSV:** Shopify-style one row per variant, downloadable template, preview with per-row validation, create or update by handle.
- **Customers:** profiles, stats, tags and notes, disable, password reset, export. Plus subscribers.
- **Discounts:** percentage, fixed, free shipping, buy X get Y; code or automatic; applies to products or collections; minimum spend or quantity; usage limits; schedule.
- **Content:** pages, blog, navigation menus, files (media library), URL redirects.
- **Analytics:** sales, net, profit (from cost), AOV, returning-customer rate, sales over time, and sales by product, category, vendor, emirate or payment method, all with CSV export. Plus a dashboard with a to-do list and activity feed.
- **Settings:** store details and TRN, theme (announcement bar, hero text, video), checkout and payments, shipping rates by emirate, taxes, languages, notifications with an email log, **staff accounts with permissions**, activity log, marketplace settings.

## Marketplace (Webkul-style)
- **Become a seller** (`/become-a-seller`): application with trade licence, TRN and IBAN; admin approval; emails.
- **Seller shop pages** (`/sellers/[slug]`) and a directory: "Sold by" on products and cart, seller ratings, contact-seller form, vacation mode, policies.
- **Seller portal** (`/seller`): dashboard, products (admin approval workflow), orders with fulfilment and tracking, earnings ledger, payout requests, reviews, messages, shop settings.
- **Commission engine:** rules by global / category / seller / product (percent, fixed or both), plus a per-seller override. A snapshot is taken on every order line. Orders split into per-seller sub-orders; earnings are credited on delivery and held for the return window; refunds debit sellers proportionally.
- **Admin:** seller approval, suspension and override, product approval queue, payouts (mark paid with bank reference), commission rules, seller review moderation.

## Production checklist
1. **Database:** set `provider = "postgresql"` in `prisma/schema.prisma`, set `DATABASE_URL`, run `npx prisma db push`.
2. **Secrets:** set `AUTH_SECRET` and `NEXT_PUBLIC_SITE_URL`.
3. **Stripe:** set `STRIPE_SECRET_KEY`; add a webhook at `/api/stripe/webhook` for `checkout.session.completed` and `checkout.session.expired`, and set `STRIPE_WEBHOOK_SECRET`.
4. **Email:** set `RESEND_API_KEY` (until then, all emails are visible in Admin → Settings → Notifications).
5. **Uploads:** they go to `public/uploads`. On serverless hosts, switch `src/lib/uploads.ts` to S3, R2 or Vercel Blob.
6. **Not yet integrated:** Tabby/Tamara BNPL (needs merchant accounts; messaging is in place) and automatic seller payouts (Stripe Connect).
7. **Legal:** have Terms, Privacy and the seller terms reviewed (UAE PDPL, consumer protection).

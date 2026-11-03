# TechRevive UAE: PC Hardware Store

A full e-commerce site for selling **certified renewed and new computer hardware in the UAE**: GPUs, CPUs, motherboards, RAM, SSDs, PSUs, cases, cooling, monitors, laptops, gaming PCs, peripherals and networking. It follows the marketplace model of revibe.me (condition grades, "% vs new" pricing, warranty, express delivery and BNPL messaging), adapted for PC parts.

**Stack:** Next.js 15 (App Router, Server Actions) · TypeScript · Tailwind CSS · Prisma (SQLite for development, Postgres in production) · Stripe

## Features

**Storefront**
- Home page with a hero, trust badges, category tiles, best sellers, Express banner, biggest savings and a "Certified Renewed" explainer
- Category, search, Hot Deals and Express pages with filters for condition, brand, price and stock, plus sorting
- Product pages with a condition picker (Brand New, Excellent, Very Good, Good), each with its own price and stock; "% vs new" pricing; pay-in-4 messaging; the Care+ extended-warranty add-on; specs; reviews; and related products
- All prices in AED, VAT-inclusive (5%), with UAE phone validation and an emirate selector

**Cart & checkout**
- Cookie-based cart that works for guests and logged-in users: change quantity, remove items, toggle the warranty add-on, with stock limits applied
- Guest checkout or account checkout using saved addresses
- Delivery: Standard (free over AED 200, otherwise AED 15) or Express next-day (AED 25, only when every item is Express-eligible)
- Coupons: percentage or fixed amount, with minimum spend and expiry dates (seeded: `WELCOME10`, `UAE50`, `BUILD75`)
- Stock is reserved inside a database transaction when the order is placed, and restored if the order is cancelled or refunded

**Payments**
- **Stripe Checkout** in AED (cards, Apple Pay, Google Pay) when `STRIPE_SECRET_KEY` is set. Payment is confirmed on the return redirect and by a webhook (`/api/stripe/webhook`).
- **Demo card gateway** for local development when no Stripe key is set. Card `4242 4242 4242 4242` succeeds and `4000 0000 0000 0002` is declined.
- **Cash / card on delivery** (AED 10 fee, orders up to AED 5,000)
- Pending card orders can be retried. Unpaid orders can be cancelled by the customer.

**Accounts**
- Register, log in and log out (bcrypt passwords, signed httpOnly JWT cookie)
- Profile and password change, saved addresses (with a default), order history and details with a status tracker, wishlist
- Guest orders placed with an email are attached to the account when the customer registers with that email
- Public order tracking by order number and email (`/track`)

**Admin** (`/admin`)
- Dashboard: paid revenue, order count, orders to fulfil, customers, low stock and recent orders
- Products: create, edit and delete; per-condition price and stock; featured, express and active flags; specs editor
- Orders: search and filter, change status (restocks automatically on cancel or refund; COD orders are marked paid when delivered)
- Coupons: create and enable/disable

## Getting started

```bash
npm install
cp .env.example .env      # then edit AUTH_SECRET
npm run setup             # creates the SQLite DB and seeds 36 products, coupons and the admin user
npm run dev               # http://localhost:3000
```

Admin login: `admin@techrevive.ae` / `admin12345` (change these via `ADMIN_EMAIL` / `ADMIN_PASSWORD` before seeding).

> ⚠️ `npm run db:seed` wipes the products, orders and coupons and re-seeds them. Use it only in development.

## Going to production

1. **Database:** set `provider = "postgresql"` in `prisma/schema.prisma` and point `DATABASE_URL` at your Postgres instance (Neon, Supabase, RDS…), then run `npx prisma db push`.
2. **Secrets:** set a long random `AUTH_SECRET` and set `NEXT_PUBLIC_SITE_URL` to your domain.
3. **Stripe:** set `STRIPE_SECRET_KEY`, then add a webhook endpoint at `https://your-domain/api/stripe/webhook` for `checkout.session.completed` and `checkout.session.expired`, and set `STRIPE_WEBHOOK_SECRET`. Stripe supports UAE businesses and AED. Alternatives such as Network International, Checkout.com, Telr or PayTabs can be added in `src/lib/payments.ts`.
4. **BNPL:** Tabby and Tamara need merchant accounts. The UI already shows pay-in-4 messaging. Add their checkout APIs as another `paymentMethod` in `src/app/actions/checkout.ts`.
5. **Images:** products use built-in SVG illustrations (`public/img`). Replace them with real photos through the admin product form (any URL; add remote hosts to `next.config.mjs`).
6. **Legal:** the Terms and Privacy pages are templates. Have them reviewed for UAE law (PDPL, consumer protection) and add your trade licence details.
7. **Email:** order confirmation emails aren't wired up yet. Hook a provider (Resend, SES, SendGrid) into `placeOrder` and `markOrderPaid`.

## Project structure

```
prisma/            schema + seed data
src/app/           routes (storefront, account, checkout, admin, api)
src/app/actions/   server actions (cart, auth, account, checkout, admin)
src/lib/           db, auth, cart, pricing, payments, orders, catalog helpers
src/components/    UI components
scripts/           SVG illustration generator
```

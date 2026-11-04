import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { getCartDetails } from "@/lib/cart";
import { getI18n, fmt } from "@/lib/i18n";
import { getSettings, pricingConfig } from "@/lib/settings";
import { aed, loc } from "@/lib/format";
import { computeTotals, warrantyPrice } from "@/lib/pricing";
import { maxQty } from "@/lib/inventory";
import { resolveCheckoutCart } from "@/lib/shipments";
import { buildShipments, etaText } from "@/lib/shipmentMath";
import { removeCartItem, saveForLater, toggleWarranty, updateCartItem } from "@/app/actions/cart";
import TrustBar from "@/components/TrustBar";

export const metadata: Metadata = { title: "Cart", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CartPage({ searchParams }: { searchParams: Promise<{ added?: string; recovered?: string }> }) {
  const sp = await searchParams;
  const [{ t, locale }, s, cart] = await Promise.all([getI18n(), getSettings(), getCartDetails()]);
  const ar = locale === "ar";
  const cfg = pricingConfig(s);
  const resolved = await resolveCheckoutCart(cart.items, cart.entries);
  const { items, blocked } = resolved;
  const totals = computeTotals(items.map((i) => ({ price: i.variant.price, quantity: i.quantity, warranty: i.warranty })), { cfg });

  // The store's default (non-express) delivery rate, used for the delivery hint and the free-delivery progress bar.
  const defaultRate = await db.shippingRate.findFirst({ where: { active: true, expressOnly: false }, orderBy: { position: "asc" } });
  const shipments = buildShipments(
    items.map((i) => ({ sellerId: i.variant.sellerId, price: i.variant.price, quantity: i.quantity, warranty: i.warranty, handlingDays: i.variant.handlingDays, express: i.product.express })),
    resolved.sellers,
    { cfg, carrier: { min: s.delivery.carrierMinDays, max: s.delivery.carrierMaxDays }, rate: defaultRate ? { id: defaultRate.id, name: defaultRate.name, nameAr: defaultRate.nameAr, price: defaultRate.price, freeAbove: defaultRate.freeAbove, deliveryDays: defaultRate.deliveryDays, expressOnly: false } : null },
  );
  const storeShipment = shipments.find((x) => x.kind === "STORE");
  const freeAbove = defaultRate?.freeAbove ?? null;

  const blockedBanner = blocked.length > 0 && (
    <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
      <p className="font-semibold">{ar ? "هذه المنتجات لم تعد متاحة ولا يمكن شراؤها:" : "These items are no longer available and can't be purchased:"}</p>
      <ul className="mt-2 space-y-1">
        {blocked.map((b) => (
          <li key={b.variantId} className="flex items-center justify-between gap-3">
            <span>{b.name} <span className="text-red-600">· {b.reason === "OUT_OF_STOCK" ? t.common.soldOut : ar ? "العرض غير متاح" : "offer unavailable"}</span></span>
            <form action={removeCartItem}><input type="hidden" name="variantId" value={b.variantId} /><button className="font-semibold underline">{t.common.remove}</button></form>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs">{ar ? "أزلها لمتابعة إتمام الطلب." : "Remove them to continue to checkout."}</p>
    </div>
  );

  if (!items.length)
    return (
      <div className="container-x py-12">
        {blockedBanner}
        <div className="py-8 text-center">
          <h1 className="text-3xl font-black">{t.cart.empty}</h1>
          <p className="mt-2 text-slate-600">{t.cart.emptyText}</p>
          <Link href="/deals" className="btn-primary mt-6">{t.home.shopDeals}</Link>
        </div>
      </div>
    );

  const storeName = loc(locale, s.storeName, s.storeNameAr);
  const N = shipments.length;

  return (
    <div className="container-x py-8">
      {sp.added && <div className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700">{t.cart.added}</div>}
      {sp.recovered && <div className="mb-4 rounded-xl bg-sky-50 px-4 py-3 text-sm font-medium text-sky-800">👋 {t.cart.recovered}</div>}
      {blockedBanner}
      <h1 className="text-3xl font-black">{t.cart.title}</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {shipments.map((sh, n) => (
            <section key={sh.key} className="space-y-3" aria-label={sh.sellerName ?? storeName}>
              <div className="flex flex-wrap items-end justify-between gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm">
                <div>
                  <p className="font-semibold">
                    {N > 1 && <span className="me-2 rounded-full bg-ink-900 px-2 py-0.5 text-xs text-white">{ar ? `شحنة ${n + 1} من ${N}` : `Shipment ${n + 1} of ${N}`}</span>}
                    {sh.kind === "SELLER" ? <>{ar ? "يُباع ويُشحن بواسطة " : "Sold & shipped by "}<b>{sh.sellerName}</b></> : <>{ar ? "يُباع ويُشحن بواسطة " : "Sold & shipped by "}<b>{storeName}</b></>}
                  </p>
                  <p className="text-xs text-slate-600">
                    {sh.etaMin != null && <>{ar ? "يصل خلال " : "Arrives in "}<b>{etaText(sh.etaMin, sh.etaMax, locale)}</b>{" · "}</>}
                    {sh.kind === "SELLER"
                      ? sh.fee > 0 ? (ar ? `رسوم التوصيل ${aed(sh.fee, locale)}` : `delivery ${aed(sh.fee, locale)}`) : (ar ? "توصيل مجاني" : "free delivery")
                      : defaultRate ? (ar ? `التوصيل من ${aed(defaultRate.price, locale)}${defaultRate.freeAbove != null ? ` (مجاني فوق ${aed(defaultRate.freeAbove, locale)})` : ""}` : `delivery from ${aed(defaultRate.price, locale)}${defaultRate.freeAbove != null ? ` (free over ${aed(defaultRate.freeAbove, locale)})` : ""}`) : ""}
                  </p>
                </div>
                <p className="font-bold">{aed(sh.subtotal, locale)}</p>
              </div>
              {sh.itemIndexes.map((idx) => {
                const i = items[idx];
                const name = loc(locale, i.product.name, i.product.nameAr);
                const vt = i.variant.title === "Default Title" ? "" : i.variant.title.split(" / ").map((x) => t.values[x] ?? x).join(" / ");
                return (
                  <div key={i.variant.id} className="card flex gap-4 p-4">
                    <Link href={`/products/${i.product.slug}`} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-50">
                      <Image src={i.variant.image || i.product.image || "/img/gpu.svg"} alt="" fill className="object-contain p-2" unoptimized />
                    </Link>
                    <div className="flex flex-1 flex-col">
                      <div className="flex justify-between gap-3">
                        <div>
                          <Link href={`/products/${i.product.slug}`} className="font-semibold hover:underline">{i.product.brand} {name}</Link>
                          {vt && <p className="text-sm text-slate-500">{vt}</p>}
                          {i.variant.conditionType && i.variant.conditionType !== "NEW" && <p className="text-xs text-slate-500">{i.variant.conditionType.replace("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}{i.variant.batteryHealth != null ? ` · ${ar ? "البطارية" : "battery"} ${i.variant.batteryHealth}%` : ""}</p>}
                          {i.quantity < i.requested && <p className="text-sm text-red-600">{fmt(t.cart.limited, { n: i.quantity })}</p>}
                        </div>
                        <p className="whitespace-nowrap font-bold">{aed(i.variant.price * i.quantity, locale)}</p>
                      </div>
                      <div className="mt-auto flex flex-wrap items-center gap-3 pt-3">
                        <form action={updateCartItem} className="flex items-center rounded-lg border border-slate-300">
                          <input type="hidden" name="variantId" value={i.variant.id} />
                          <button name="quantity" value={i.quantity - 1} className="px-3 py-1.5 hover:bg-slate-100" aria-label="-">−</button>
                          <span className="w-8 text-center text-sm font-semibold">{i.quantity}</span>
                          <button name="quantity" value={i.quantity + 1} className="px-3 py-1.5 hover:bg-slate-100 disabled:opacity-30" disabled={i.quantity >= maxQty(i.variant, 20)} aria-label="+">+</button>
                        </form>
                        <form action={toggleWarranty}>
                          <input type="hidden" name="variantId" value={i.variant.id} />
                          <button className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${i.warranty ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-300"}`}>
                            {i.warranty ? t.cart.carePlusAdded : t.cart.carePlus} ({aed(warrantyPrice(i.variant.price, cfg), locale)}{t.cart.perUnit})
                          </button>
                        </form>
                        <form action={saveForLater}><input type="hidden" name="variantId" value={i.variant.id} /><button className="text-sm text-slate-500 hover:text-brand-700">♡ {t.cart.saveForLater}</button></form>
                        <form action={removeCartItem} className="ms-auto"><input type="hidden" name="variantId" value={i.variant.id} /><button className="text-sm text-slate-500 hover:text-red-600">{t.common.remove}</button></form>
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>
          ))}
        </div>
        <aside className="card h-fit space-y-3 p-5 lg:sticky lg:top-36">
          <h2 className="text-lg font-bold">{t.cart.summary}</h2>
          <div className="flex justify-between text-sm"><span>{t.cart.subtotal}</span><span>{aed(totals.subtotal, locale)}</span></div>
          <p className="text-xs text-slate-500">
            {N > 1
              ? (ar ? `سيتم شحن طلبك في ${N} شحنات منفصلة، ولكل شحنة رسوم توصيل وموعد وصول خاص بها. تُحسب عند إتمام الطلب.` : `Your order ships as ${N} separate shipments, each with its own delivery fee and arrival time. Calculated at checkout.`)
              : (ar ? "تُحسب رسوم التوصيل عند إتمام الطلب." : "Delivery is calculated at checkout.")}
          </p>
          {storeShipment && freeAbove != null && (
            totals.subtotal < freeAbove && storeShipment.subtotal < freeAbove ? (
              <div>
                <p className="text-xs text-slate-600">{fmt(t.cart.addMore, { amount: aed(freeAbove - storeShipment.subtotal, locale) })}{N > 1 ? (ar ? ` (من ${storeName})` : ` (from ${storeName})`) : ""}</p>
                <div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand-600" style={{ width: `${Math.min(100, (storeShipment.subtotal / freeAbove) * 100)}%` }} /></div>
              </div>
            ) : <p className="text-xs font-semibold text-brand-700">✓ {ar ? `توصيل مجاني من ${storeName}` : `Free delivery from ${storeName}`}</p>
          )}
          <div className="border-t pt-3"><div className="flex justify-between"><b>{ar ? "الإجمالي (قبل التوصيل)" : "Total (before delivery)"}</b><b className="text-lg">{aed(totals.total, locale)}</b></div></div>
          <p className="text-xs text-slate-500">{fmt(t.cart.includesVat, { amount: aed(totals.vat, locale) })}</p>
          {blocked.length > 0
            ? <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{ar ? "أزل المنتجات غير المتاحة لمتابعة إتمام الطلب." : "Remove the unavailable items to continue to checkout."}</p>
            : <Link href="/checkout" className="btn-primary w-full">{t.cart.checkout}</Link>}
          <Link href="/" className="btn-outline w-full">{t.common.continueShopping}</Link>
        </aside>
      </div>
      <div className="mt-10"><TrustBar /></div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getCartDetails } from "@/lib/cart";
import { getI18n, fmt } from "@/lib/i18n";
import { getSettings, pricingConfig } from "@/lib/settings";
import { aed, loc } from "@/lib/format";
import { computeTotals, warrantyPrice } from "@/lib/pricing";
import { maxQty } from "@/lib/inventory";
import { removeCartItem, saveForLater, toggleWarranty, updateCartItem } from "@/app/actions/cart";
import TrustBar from "@/components/TrustBar";

export const metadata: Metadata = { title: "Cart", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CartPage({ searchParams }: { searchParams: Promise<{ added?: string; recovered?: string }> }) {
  const sp = await searchParams;
  const [{ t, locale }, s, { items }] = await Promise.all([getI18n(), getSettings(), getCartDetails()]);
  const cfg = pricingConfig(s);
  const totals = computeTotals(items.map((i) => ({ price: i.variant.price, quantity: i.quantity, warranty: i.warranty })), { cfg });
  const freeAbove = 200;

  if (!items.length)
    return (
      <div className="container-x py-20 text-center">
        <h1 className="text-3xl font-black">{t.cart.empty}</h1>
        <p className="mt-2 text-slate-600">{t.cart.emptyText}</p>
        <Link href="/deals" className="btn-primary mt-6">{t.home.shopDeals}</Link>
      </div>
    );

  // group by seller
  const groups = new Map<string, typeof items>();
  for (const i of items) {
    const k = i.product.seller?.shopName ?? loc(locale, s.storeName, s.storeNameAr);
    groups.set(k, [...(groups.get(k) ?? []), i]);
  }

  return (
    <div className="container-x py-8">
      {sp.added && <div className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700">{t.cart.added}</div>}
      {sp.recovered && <div className="mb-4 rounded-xl bg-sky-50 px-4 py-3 text-sm font-medium text-sky-800">👋 {t.cart.recovered}</div>}
      <h1 className="text-3xl font-black">{t.cart.title}</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {[...groups.entries()].map(([seller, list]) => (
            <div key={seller} className="space-y-3">
              {groups.size > 1 && <p className="text-sm font-semibold text-slate-500">{locale === "ar" ? "يُباع بواسطة" : "Sold by"} {seller}</p>}
              {list.map((i) => {
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
            </div>
          ))}
        </div>
        <aside className="card h-fit space-y-3 p-5 lg:sticky lg:top-36">
          <h2 className="text-lg font-bold">{t.cart.summary}</h2>
          <div className="flex justify-between text-sm"><span>{t.cart.subtotal}</span><span>{aed(totals.subtotal, locale)}</span></div>
          {totals.subtotal < freeAbove ? (
            <div>
              <p className="text-xs text-slate-600">{fmt(t.cart.addMore, { amount: aed(freeAbove - totals.subtotal, locale) })}</p>
              <div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand-600" style={{ width: `${Math.min(100, (totals.subtotal / freeAbove) * 100)}%` }} /></div>
            </div>
          ) : <p className="text-xs font-semibold text-brand-700">✓ {t.trust.delivery}</p>}
          <div className="border-t pt-3"><div className="flex justify-between"><b>{t.cart.total}</b><b className="text-lg">{aed(totals.total, locale)}</b></div></div>
          <p className="text-xs text-slate-500">{fmt(t.cart.includesVat, { amount: aed(totals.vat, locale) })}</p>
          <Link href="/checkout" className="btn-primary w-full">{t.cart.checkout}</Link>
          <Link href="/" className="btn-outline w-full">{t.common.continueShopping}</Link>
        </aside>
      </div>
      <div className="mt-10"><TrustBar /></div>
    </div>
  );
}

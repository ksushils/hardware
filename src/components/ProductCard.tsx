import Link from "next/link";
import Image from "next/image";
import { availableConditions, bestVariant, rating, type CatalogProduct } from "@/lib/catalog";
import { aed, loc, pctOff } from "@/lib/format";
import { installment } from "@/lib/pricing";
import { isAvailable, newPriceFor } from "@/lib/inventory";
import { getI18n, fmt } from "@/lib/i18n";
import { CompareToggle } from "./Compare";
import { BoltIcon, StarIcon } from "./Icons";

export default async function ProductCard({ product, priority }: { product: CatalogProduct; priority?: boolean }) {
  const { t, locale } = await getI18n();
  const best = bestVariant(product);
  const price = best?.price ?? 0;
  const condIdx = Math.max(0, product.options.findIndex((o) => o.name.toLowerCase() === "condition"));
  const refNew = best ? newPriceFor(best, product.variants, product.priceNew, condIdx) : product.priceNew;
  const off = pctOff(price, refNew);
  const r = rating(product);
  const conditions = availableConditions(product);
  const soldOut = !product.variants.some(isAvailable);
  const lowStock = !soldOut && product.variants.filter(isAvailable).reduce((s, v) => s + (v.trackInventory ? v.stock : 99), 0) <= 2;
  const name = loc(locale, product.name, product.nameAr);

  return (
    <Link href={`/products/${product.slug}`} className="card group relative flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-square bg-slate-50 p-4">
        <Image src={product.image || "/img/gpu.svg"} alt={name} fill priority={priority} sizes="(max-width:768px) 50vw, 25vw" className="object-contain p-6 transition group-hover:scale-105" unoptimized={product.image.endsWith(".svg")} />
        <div className="absolute start-3 top-3 flex flex-col items-start gap-1.5">
          {off > 0 && <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-white">{fmt(t.card.vsNew, { n: off })}</span>}
          {product.express && <span className="flex items-center gap-1 rounded-full bg-ink-900 px-2.5 py-1 text-xs font-bold text-white"><BoltIcon className="h-3 w-3" /> {t.common.express}</span>}
        </div>
        <div className="absolute end-3 top-3 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100"><CompareToggle slug={product.slug} compact /></div>
        {soldOut && <span className="absolute inset-x-0 bottom-0 bg-slate-900/80 py-1.5 text-center text-xs font-semibold text-white">{t.common.soldOut}</span>}
        {lowStock && <span className="absolute inset-x-0 bottom-0 bg-amber-500/90 py-1 text-center text-xs font-semibold text-white">{locale === "ar" ? "كمية محدودة" : "Almost gone"}</span>}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{product.brand}</p>
        <h3 className="mt-1 line-clamp-2 font-semibold leading-snug">{name}</h3>
        <p className="mt-1 text-xs text-slate-500">{conditions.map((c) => t.values[c] ?? c).join(" · ") || (soldOut ? t.card.outOfStock : "")}</p>
        {r && <p className="mt-1 flex items-center gap-1 text-xs text-amber-500"><StarIcon filled className="h-3.5 w-3.5" /> <span className="text-slate-600">{r.avg.toFixed(1)} ({r.count})</span></p>}
        <div className="mt-auto pt-3">
          <p className="text-xs text-slate-500">{t.common.from}</p>
          <p className="text-lg font-extrabold">{aed(price, locale)}</p>
          {refNew > price && <p className="text-xs text-slate-500"><span className="line-through">{aed(refNew, locale)}</span> {t.common.new}</p>}
          <p className="mt-1 text-xs text-brand-700">{fmt(t.card.installments, { amount: aed(installment(price), locale) })}</p>
        </div>
      </div>
    </Link>
  );
}

export async function ProductGrid({ products }: { products: CatalogProduct[] }) {
  const { t } = await getI18n();
  if (!products.length) return <p className="card p-10 text-center text-slate-500">{t.listing.noProducts}</p>;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
      {products.map((p, i) => <ProductCard key={p.id} product={p} priority={i < 4} />)}
    </div>
  );
}

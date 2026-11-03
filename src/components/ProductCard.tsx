import Link from "next/link";
import Image from "next/image";
import { bestVariant, rating, type CatalogProduct } from "@/lib/catalog";
import { aed, conditionLabel, pctOff, CONDITION_ORDER } from "@/lib/format";
import { installment } from "@/lib/pricing";
import { BoltIcon, StarIcon } from "./Icons";

export default function ProductCard({ product }: { product: CatalogProduct }) {
  const best = bestVariant(product);
  const off = pctOff(best.price, product.priceNew);
  const r = rating(product);
  const conditions = CONDITION_ORDER.filter((c) => product.variants.some((v) => v.condition === c && v.stock > 0));
  const soldOut = product.variants.every((v) => v.stock <= 0);

  return (
    <Link href={`/products/${product.slug}`} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-square bg-slate-50 p-4">
        <Image src={product.image} alt={product.name} fill sizes="(max-width:768px) 50vw, 25vw" className="object-contain p-6 transition group-hover:scale-105" unoptimized={product.image.endsWith(".svg")} />
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {off > 0 && <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-white">-{off}% vs new</span>}
          {product.express && (
            <span className="flex items-center gap-1 rounded-full bg-ink-900 px-2.5 py-1 text-xs font-bold text-white"><BoltIcon className="h-3 w-3" /> Express</span>
          )}
        </div>
        {soldOut && <span className="absolute inset-x-0 bottom-0 bg-slate-900/80 py-1.5 text-center text-xs font-semibold text-white">Sold out</span>}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{product.brand}</p>
        <h3 className="mt-1 line-clamp-2 font-semibold leading-snug">{product.name}</h3>
        <p className="mt-1 text-xs text-slate-500">{conditions.map(conditionLabel).join(" · ") || "Out of stock"}</p>
        {r && (
          <p className="mt-1 flex items-center gap-1 text-xs text-amber-500">
            <StarIcon filled className="h-3.5 w-3.5" /> <span className="text-slate-600">{r.avg.toFixed(1)} ({r.count})</span>
          </p>
        )}
        <div className="mt-auto pt-3">
          <p className="text-xs text-slate-500">From</p>
          <p className="text-lg font-extrabold">{aed(best.price)}</p>
          <p className="text-xs text-slate-500"><span className="line-through">{aed(product.priceNew)}</span> new</p>
          <p className="mt-1 text-xs text-brand-700">or 4 × {aed(installment(best.price))} interest-free</p>
        </div>
      </div>
    </Link>
  );
}

export function ProductGrid({ products }: { products: CatalogProduct[] }) {
  if (!products.length) return <p className="card p-10 text-center text-slate-500">No products found.</p>;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
      {products.map((p) => <ProductCard key={p.id} product={p} />)}
    </div>
  );
}

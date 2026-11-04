import { Suspense } from "react";
import { searchWithFacets, type ProductQuery } from "@/lib/catalog";
import { getI18n, fmt } from "@/lib/i18n";
import { ProductGrid } from "./ProductCard";
import Filters, { SortSelect } from "./Filters";

type SP = Record<string, string | string[] | undefined>;
const arr = (v: string | string[] | undefined) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const num = (v: string | string[] | undefined) => {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return v && !Number.isNaN(n) ? n : undefined;
};

export function queryFromParams(sp: SP, base: ProductQuery): ProductQuery {
  const options: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(sp)) if (k.startsWith("o_")) options[k.slice(2)] = arr(v);
  // legacy ?condition= links
  if (sp.condition) options.Condition = [...(options.Condition ?? []), ...arr(sp.condition)];
  return {
    ...base,
    q: base.q ?? (typeof sp.q === "string" ? sp.q : undefined),
    brand: arr(sp.brand),
    sellers: arr(sp.seller),
    categories: arr(sp.cat),
    options,
    min: num(sp.min),
    max: num(sp.max),
    rating: num(sp.rating),
    sort: typeof sp.sort === "string" ? sp.sort : base.sort,
    inStock: sp.instock === "1" || base.inStock,
  };
}

export default async function Listing({ title, subtitle, searchParams, base, header }: { title: string; subtitle?: string; searchParams: SP; base: ProductQuery; header?: React.ReactNode }) {
  const { t } = await getI18n();
  const query = queryFromParams(searchParams, base);
  const { products, facets } = await searchWithFacets(query);
  return (
    <div className="container-x py-8">
      {header}
      <h1 className="text-3xl font-black tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-slate-600">{subtitle}</p>}
      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
        <Suspense><Filters facets={facets} showCategories={!base.category} /></Suspense>
        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500">{fmt(t.listing.count, { n: products.length })}</p>
            <Suspense><SortSelect value={query.sort ?? "featured"} /></Suspense>
          </div>
          <ProductGrid products={products} />
        </div>
      </div>
    </div>
  );
}

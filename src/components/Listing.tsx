import { db } from "@/lib/db";
import { searchProducts, type ProductQuery } from "@/lib/catalog";
import { CONDITIONS, CONDITION_ORDER } from "@/lib/format";
import { ProductGrid } from "./ProductCard";

type SP = Record<string, string | string[] | undefined>;
const arr = (v: string | string[] | undefined) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const num = (v: string | string[] | undefined) => {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return v && !Number.isNaN(n) ? n : undefined;
};

export default async function Listing({
  title, subtitle, searchParams, base,
}: { title: string; subtitle?: string; searchParams: SP; base: ProductQuery }) {
  const query: ProductQuery = {
    ...base,
    q: base.q ?? (typeof searchParams.q === "string" ? searchParams.q : undefined),
    brand: arr(searchParams.brand),
    condition: arr(searchParams.condition),
    min: num(searchParams.min),
    max: num(searchParams.max),
    sort: typeof searchParams.sort === "string" ? searchParams.sort : base.sort,
    inStock: searchParams.instock === "1" || base.inStock,
  };
  const [products, brandRows] = await Promise.all([
    searchProducts(query),
    db.product.findMany({
      where: { active: true, ...(base.category ? { category: { slug: base.category } } : {}), ...(base.express ? { express: true } : {}) },
      select: { brand: true }, distinct: ["brand"], orderBy: { brand: "asc" },
    }),
  ]);

  return (
    <div className="container-x py-8">
      <h1 className="text-3xl font-black tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-slate-600">{subtitle}</p>}
      <div className="mt-6 grid gap-6 lg:grid-cols-[250px_1fr]">
        <form className="card h-fit space-y-6 p-5 lg:sticky lg:top-36">
          {query.q && !base.q && <input type="hidden" name="q" value={query.q} />}
          <div>
            <label className="label" htmlFor="sort">Sort by</label>
            <select id="sort" name="sort" defaultValue={query.sort ?? "featured"} className="input py-2">
              <option value="featured">Featured</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="discount">Biggest discount</option>
              <option value="name">Name</option>
            </select>
          </div>
          <fieldset>
            <legend className="label">Condition</legend>
            {CONDITION_ORDER.map((c) => (
              <label key={c} className="flex items-center gap-2 py-1 text-sm">
                <input type="checkbox" name="condition" value={c} defaultChecked={query.condition?.includes(c)} className="accent-brand-600" />
                {CONDITIONS[c].label}
              </label>
            ))}
          </fieldset>
          {brandRows.length > 1 && (
            <fieldset>
              <legend className="label">Brand</legend>
              <div className="max-h-48 overflow-y-auto">
                {brandRows.map(({ brand }) => (
                  <label key={brand} className="flex items-center gap-2 py-1 text-sm">
                    <input type="checkbox" name="brand" value={brand} defaultChecked={query.brand?.includes(brand)} className="accent-brand-600" />
                    {brand}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <fieldset>
            <legend className="label">Price (AED)</legend>
            <div className="flex gap-2">
              <input name="min" type="number" min={0} placeholder="Min" defaultValue={query.min} className="input py-2" />
              <input name="max" type="number" min={0} placeholder="Max" defaultValue={query.max} className="input py-2" />
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="instock" value="1" defaultChecked={query.inStock} className="accent-brand-600" /> In stock only
          </label>
          <button className="btn-primary w-full">Apply filters</button>
        </form>
        <div>
          <p className="mb-4 text-sm text-slate-500">{products.length} product{products.length === 1 ? "" : "s"}</p>
          <ProductGrid products={products} />
        </div>
      </div>
    </div>
  );
}

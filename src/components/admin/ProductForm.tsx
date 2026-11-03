"use client";
import { useFormAction } from "@/hooks/useFormAction";
import type { Category, Product, Variant } from "@prisma/client";
import { saveProduct } from "@/app/actions/admin";
import { CONDITIONS, CONDITION_ORDER, parseSpecs } from "@/lib/format";

const IMAGES = ["gpu", "cpu", "motherboard", "ram", "storage", "psu", "case", "cooling", "monitor", "laptop", "pc", "peripherals", "networking"];

export default function ProductForm({ categories, product }: { categories: Category[]; product?: Product & { variants: Variant[] } }) {
  const { state, pending, formProps } = useFormAction(saveProduct);
  const specs = product ? Object.entries(parseSpecs(product.specs)).map(([k, v]) => `${k}: ${v}`).join("\n") : "";
  return (
    <form {...formProps} className="card space-y-5 p-6">
      {product && <input type="hidden" name="id" value={product.id} />}
      <div className="grid gap-4 md:grid-cols-2">
        <label><span className="label">Name</span><input name="name" required defaultValue={product?.name} className="input" /></label>
        <label><span className="label">Brand</span><input name="brand" required defaultValue={product?.brand} className="input" /></label>
        <label><span className="label">Category</span>
          <select name="categoryId" defaultValue={product?.categoryId} className="input">{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </label>
        <label><span className="label">Brand-new reference price (AED)</span><input name="priceNew" type="number" step="0.01" required defaultValue={product?.priceNew} className="input" /></label>
        <label className="md:col-span-2"><span className="label">Image URL (or pick a built-in illustration)</span>
          <input name="image" list="imgs" defaultValue={product?.image ?? "/img/gpu.svg"} className="input" />
          <datalist id="imgs">{IMAGES.map((i) => <option key={i} value={`/img/${i}.svg`} />)}</datalist>
        </label>
      </div>
      <label className="block"><span className="label">Description</span><textarea name="description" rows={3} defaultValue={product?.description} className="input" /></label>
      <label className="block"><span className="label">Specifications (one per line, &quot;Key: Value&quot;)</span><textarea name="specs" rows={5} defaultValue={specs} className="input font-mono text-xs" /></label>
      <div>
        <p className="label">Conditions, prices & stock (leave the price empty to disable a condition)</p>
        <div className="grid gap-3 md:grid-cols-4">
          {CONDITION_ORDER.map((c) => {
            const v = product?.variants.find((x) => x.condition === c);
            return (
              <div key={c} className="rounded-xl border p-3">
                <p className="text-sm font-semibold">{CONDITIONS[c].label}</p>
                <input name={`price_${c}`} type="number" step="0.01" placeholder="Price AED" defaultValue={v?.price} className="input mt-2 py-2" />
                <input name={`stock_${c}`} type="number" placeholder="Stock" defaultValue={v?.stock ?? 0} className="input mt-2 py-2" />
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="active" defaultChecked={product?.active ?? true} className="accent-brand-600" /> Active (visible in store)</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="featured" defaultChecked={product?.featured} className="accent-brand-600" /> Featured / best seller</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="express" defaultChecked={product?.express} className="accent-brand-600" /> Express next-day eligible</label>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className="btn-primary" disabled={pending}>{pending ? "Saving..." : "Save product"}</button>
    </form>
  );
}

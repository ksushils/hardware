"use client";
import { useMemo, useState } from "react";
import { useFormAction } from "@/hooks/useFormAction";
import { saveSellerProduct } from "@/app/actions/seller";
import OfferTermsFields, { type OfferTermsInitial } from "./OfferTermsFields";

type Opt = { name: string; nameAr: string; values: string[] };
type Var = { option1: string | null; option2: string | null; option3: string | null; price: number | string; comparePrice: number | string | null; stock: number | string; sku: string };
export type SellerProductInitial = {
  id?: string; name: string; nameAr: string; description: string; descriptionAr: string; categoryId: string; brand: string; productType: string;
  priceNew: number; tags: string; specs: Record<string, string>; images: string[]; options: Opt[]; variants: Var[]; approvalStatus?: string; rejectionReason?: string | null;
};
const CONDITIONS = ["Brand New", "Excellent", "Very Good", "Good"];

export default function SellerProductForm({ initial, categories, terms, minReturnDays, locked = false }: { initial: SellerProductInitial; categories: { id: string; name: string }[]; terms: OfferTermsInitial; minReturnDays: number; locked?: boolean }) {
  const { state, pending, formProps } = useFormAction(saveSellerProduct);
  const [images, setImages] = useState(initial.images);
  const [specs, setSpecs] = useState<[string, string][]>(Object.entries(initial.specs).length ? Object.entries(initial.specs) : [["", ""]]);
  const [options, setOptions] = useState<Opt[]>(initial.options.length ? initial.options : [{ name: "Condition", nameAr: "الحالة", values: ["Excellent"] }]);
  const [variants, setVariants] = useState<Var[]>(initial.variants);
  const [newVal, setNewVal] = useState<string[]>(["", "", ""]);

  // regenerate the matrix, keeping existing rows by option combination
  const matrix = useMemo(() => {
    const opts = options.filter((o) => o.name && o.values.length);
    if (!opts.length) return [[null, null, null]] as (string | null)[][];
    let combos: (string | null)[][] = [[]];
    for (const o of opts) combos = combos.flatMap((c) => o.values.map((v) => [...c, v]));
    return combos.map((c) => [c[0] ?? null, c[1] ?? null, c[2] ?? null]);
  }, [options]);
  const key = (a: (string | null)[]) => a.map((x) => x ?? "").join("|");
  // when the product page is locked (shared with other sellers) only the seller's own offers are listed
  const rows: Var[] = locked ? variants : matrix.map((m) => variants.find((v) => key([v.option1, v.option2, v.option3]) === key(m)) ?? { option1: m[0], option2: m[1], option3: m[2], price: "", comparePrice: "", stock: 0, sku: "" });
  const setRow = (i: number, patch: Partial<Var>) => {
    const r = { ...rows[i], ...patch };
    setVariants([...variants.filter((v) => key([v.option1, v.option2, v.option3]) !== key([r.option1, r.option2, r.option3])), r]);
  };
  const setOpt = (i: number, patch: Partial<Opt>) => setOptions(options.map((o, j) => (j === i ? { ...o, ...patch } : o)));

  return (
    <form {...formProps} className="space-y-5">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="images" value={JSON.stringify(images)} />
      <input type="hidden" name="specs" value={JSON.stringify(Object.fromEntries(specs.filter(([k, v]) => k.trim() && v.trim())))} />
      <input type="hidden" name="options" value={JSON.stringify(options)} />
      <input type="hidden" name="variants" value={JSON.stringify(rows)} />
      {initial.approvalStatus === "REJECTED" && initial.rejectionReason && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700"><b>Changes requested:</b> {initial.rejectionReason}</p>}
      {locked && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">This product page is shared with other sellers, so its title, description, images and options can only be changed by the marketplace team. You can edit your own prices, stock and terms below.</p>}
      {initial.approvalStatus === "APPROVED" && !locked && <p className="rounded-lg bg-sky-50 p-3 text-sm text-sky-800">This product is live. Price and stock changes go live instantly; changes to content, images or options are re-reviewed by the marketplace team.</p>}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold">Product details</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label><span className="label">Title (English)</span><input readOnly={locked} name="name" defaultValue={initial.name} required className="in-a" /></label>
          <label><span className="label">Title (Arabic)</span><input readOnly={locked} name="nameAr" defaultValue={initial.nameAr} dir="rtl" className="in-a" /></label>
          <label><span className="label">Description (English)</span><textarea readOnly={locked} name="description" defaultValue={initial.description} rows={5} required className="in-a" /></label>
          <label><span className="label">Description (Arabic)</span><textarea readOnly={locked} name="descriptionAr" defaultValue={initial.descriptionAr} rows={5} dir="rtl" className="in-a" /></label>
          {locked && <input type="hidden" name="categoryId" value={initial.categoryId} />}
          <label><span className="label">Category</span><select name="categoryId" defaultValue={initial.categoryId} required disabled={locked} className="in-a"><option value="">Choose…</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label><span className="label">Brand</span><input readOnly={locked} name="brand" defaultValue={initial.brand} required className="in-a" /></label>
          <label><span className="label">Product type</span><input readOnly={locked} name="productType" defaultValue={initial.productType} placeholder="e.g. Graphics Card" className="in-a" /></label>
          <label><span className="label">Brand-new reference price (AED)</span><input readOnly={locked} name="priceNew" type="number" step="0.01" defaultValue={initial.priceNew || ""} placeholder="Shown as “x% vs new”" className="in-a" /></label>
          <label className="md:col-span-2"><span className="label">Tags (comma separated)</span><input readOnly={locked} name="tags" defaultValue={initial.tags} className="in-a" /></label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold">Images</h2>
        <div className="flex flex-wrap gap-3">
          {images.map((u, i) => (
            <div key={u + i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="h-24 w-24 rounded-lg border bg-slate-50 object-contain" />
              {i === 0 && <span className="absolute start-1 top-1 rounded bg-slate-900 px-1 text-[10px] text-white">Main</span>}
              <div className="mt-1 flex justify-center gap-1 text-xs">
                {i > 0 && <button type="button" onClick={() => setImages([u, ...images.filter((_, j) => j !== i)])} className="text-sky-700">Make main</button>}
                <button type="button" onClick={() => setImages(images.filter((_, j) => j !== i))} className="text-red-600">Remove</button>
              </div>
            </div>
          ))}
        </div>
        {!locked && <input type="file" name="newImages" accept="image/*" multiple className="mt-3 text-sm" />}
        <p className="mt-1 text-xs text-slate-500">Use real photos of the unit you&apos;re selling. JPG/PNG/WebP up to 25MB each.</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold">Specifications</h2>
        <div className="space-y-2">
          {specs.map(([k, v], i) => (
            <div key={i} className="flex gap-2">
              <input value={k} onChange={(e) => setSpecs(specs.map((s, j) => (j === i ? [e.target.value, s[1]] : s)))} placeholder="e.g. Memory" className="in-a" />
              <input value={v} onChange={(e) => setSpecs(specs.map((s, j) => (j === i ? [s[0], e.target.value] : s)))} placeholder="e.g. 12GB GDDR6X" className="in-a" />
              <button type="button" onClick={() => setSpecs(specs.filter((_, j) => j !== i))} className="btn-a-danger">✕</button>
            </div>
          ))}
          <button type="button" onClick={() => setSpecs([...specs, ["", ""]])} className="btn-a">+ Add spec</button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold">{locked ? "Your offers (variants)" : "Options & variants"}</h2>
        <p className="mb-3 text-xs text-slate-500">Most listings use one option, &quot;Condition&quot;. Add &quot;Capacity&quot; or &quot;Color&quot; if you stock several versions.</p>
        <div className={locked ? "hidden" : "space-y-3"}>
          {options.map((o, i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap gap-2">
                <input value={o.name} onChange={(e) => setOpt(i, { name: e.target.value })} placeholder="Option name" className="in-a w-40" />
                <input value={o.nameAr} onChange={(e) => setOpt(i, { nameAr: e.target.value })} placeholder="الاسم بالعربية" dir="rtl" className="in-a w-40" />
                <button type="button" onClick={() => setOptions(options.filter((_, j) => j !== i))} className="btn-a-danger ms-auto">Remove option</button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {o.values.map((v) => <span key={v} className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">{v}<button type="button" onClick={() => setOpt(i, { values: o.values.filter((x) => x !== v) })} aria-label={`Remove ${v}`}>✕</button></span>)}
                {o.name.toLowerCase() === "condition"
                  ? CONDITIONS.filter((c) => !o.values.includes(c)).map((c) => <button type="button" key={c} onClick={() => setOpt(i, { values: [...o.values, c] })} className="rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-xs">+ {c}</button>)
                  : <>
                      <input value={newVal[i]} onChange={(e) => setNewVal(newVal.map((x, j) => (j === i ? e.target.value : x)))} placeholder="Add value" className="in-a w-32 py-1"
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const v = newVal[i].trim(); if (v && !o.values.includes(v)) setOpt(i, { values: [...o.values, v] }); setNewVal(newVal.map((x, j) => (j === i ? "" : x))); } }} />
                      <span className="text-xs text-slate-400">press Enter</span>
                    </>}
              </div>
            </div>
          ))}
          {options.length < 3 && <button type="button" onClick={() => setOptions([...options, { name: "", nameAr: "", values: [] }])} className="btn-a">+ Add option</button>}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-2 py-2 text-start">Variant</th><th className="px-2 py-2 text-start">Price (AED)</th><th className="px-2 py-2 text-start">Compare-at</th><th className="px-2 py-2 text-start">Stock</th><th className="px-2 py-2 text-start">SKU</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={key([r.option1, r.option2, r.option3])}>
                  <td className="px-2 py-1.5 font-medium">{[r.option1, r.option2, r.option3].filter(Boolean).join(" / ") || "Default"}</td>
                  <td className="px-2 py-1.5"><input type="number" step="0.01" value={r.price} onChange={(e) => setRow(i, { price: e.target.value })} className="in-a w-28 py-1" required /></td>
                  <td className="px-2 py-1.5"><input type="number" step="0.01" value={r.comparePrice ?? ""} onChange={(e) => setRow(i, { comparePrice: e.target.value })} className="in-a w-28 py-1" /></td>
                  <td className="px-2 py-1.5"><input type="number" min={0} value={r.stock} onChange={(e) => setRow(i, { stock: e.target.value })} className="in-a w-20 py-1" /></td>
                  <td className="px-2 py-1.5"><input value={r.sku} onChange={(e) => setRow(i, { sku: e.target.value })} className="in-a w-36 py-1" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <OfferTermsFields initial={terms} minReturnDays={minReturnDays} />

      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <div className="sticky bottom-0 flex gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
        <button className="btn-a-primary" disabled={pending}>{pending ? "Saving…" : initial.id ? "Save changes" : "Submit for approval"}</button>
        {!initial.id && <button name="draft" value="1" className="btn-a" disabled={pending} onClick={(e) => { const f = e.currentTarget.form; if (f) { f.querySelectorAll('input[name="draft"]').forEach((n) => n.remove()); const h = document.createElement("input"); h.type = "hidden"; h.name = "draft"; h.value = "1"; f.appendChild(h); setTimeout(() => h.remove(), 0); } }}>Save as draft</button>}
      </div>
    </form>
  );
}

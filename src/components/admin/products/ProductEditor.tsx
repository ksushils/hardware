"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveProduct, type ProductInput, type VariantInput } from "@/app/actions/admin/products";

type Option = { name: string; nameAr: string; values: string[] };
type Props = {
  initial: ProductInput;
  categories: { id: string; name: string }[];
  collections: { id: string; title: string }[];
  smartCollections?: string[];
  storeHost?: string;
};

const blankVariant = (base?: Partial<VariantInput>): VariantInput => ({
  option1: null, option2: null, option3: null, price: base?.price ?? "", comparePrice: base?.comparePrice ?? "", cost: base?.cost ?? "",
  sku: "", barcode: "", stock: 0, weight: base?.weight ?? "", trackInventory: base?.trackInventory ?? true, continueSelling: base?.continueSelling ?? false, image: "",
});

function combos(options: Option[]): (string | null)[][] {
  const live = options.filter((o) => o.name.trim() && o.values.length);
  if (!live.length) return [[null, null, null]];
  let acc: string[][] = [[]];
  for (const o of live) acc = acc.flatMap((a) => o.values.map((v) => [...a, v]));
  return acc.map((c) => [c[0] ?? null, c[1] ?? null, c[2] ?? null]);
}
const keyOf = (v: { option1: string | null; option2: string | null; option3: string | null }) => [v.option1, v.option2, v.option3].join("\u0000");

function regenerate(options: Option[], variants: VariantInput[]): VariantInput[] {
  const list = combos(options);
  if (list.length === 1 && list[0][0] === null) {
    const v = variants[0] ?? blankVariant();
    return [{ ...v, option1: null, option2: null, option3: null }];
  }
  const base = variants[0];
  return list.map(([o1, o2, o3]) => {
    const found = variants.find((v) => keyOf(v) === keyOf({ option1: o1, option2: o2, option3: o3 }));
    return found ?? { ...blankVariant(base), option1: o1, option2: o2, option3: o3 };
  });
}

export default function ProductEditor({ initial, categories, collections, smartCollections = [], storeHost = "techrevive.ae" }: Props) {
  const router = useRouter();
  const [p, setP] = useState<ProductInput>(initial);
  const [options, setOptions] = useState<Option[]>(initial.options);
  const [variants, setVariants] = useState<VariantInput[]>(initial.variants.length ? initial.variants : [blankVariant()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const set = <K extends keyof ProductInput>(k: K, v: ProductInput[K]) => { setP((s) => ({ ...s, [k]: v })); setDirty(true); };
  const updateOptions = (next: Option[]) => { setOptions(next); setVariants((v) => regenerate(next, v)); setDirty(true); };
  const removeOption = (idx: number) => {
    const next = options.filter((_, i) => i !== idx);
    const keys = ["option1", "option2", "option3"] as const;
    const shifted = variants.map((v) => {
      const vals = keys.map((k) => v[k]).filter((_, i) => i !== idx);
      return { ...v, option1: vals[0] ?? null, option2: vals[1] ?? null, option3: null };
    });
    const seen = new Set<string>();
    const dedup = shifted.filter((v) => (seen.has(keyOf(v)) ? false : (seen.add(keyOf(v)), true)));
    setOptions(next);
    setVariants(regenerate(next, dedup));
    setDirty(true);
  };
  const setVariant = (i: number, patch: Partial<VariantInput>) => { setVariants((vs) => vs.map((v, j) => (j === i ? { ...v, ...patch } : v))); setDirty(true); };

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("file", f));
    fd.append("alt", p.name);
    try {
      const res = await fetch("/api/admin/products/upload", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Upload failed");
      set("images", [...p.images, ...j.files]);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Upload failed" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  const moveImage = (i: number, d: number) => {
    const imgs = [...p.images];
    const j = i + d;
    if (j < 0 || j >= imgs.length) return;
    [imgs[i], imgs[j]] = [imgs[j], imgs[i]];
    set("images", imgs);
  };

  const save = () => {
    setMsg(null);
    start(async () => {
      const r = await saveProduct({ ...p, options, variants });
      if (r.error) {
        setErrors(r.fieldErrors ?? {});
        setMsg({ ok: false, text: r.error });
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setErrors({});
      setDirty(false);
      if (!p.id) router.push(`/admin/products/${r.id}?saved=1`);
      else { setMsg({ ok: true, text: "Product saved." }); router.refresh(); }
    });
  };

  const totalStock = variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
  const slugPreview = useMemo(() => (p.slug || p.name).toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, "-").replace(/(^-|-$)/g, ""), [p.slug, p.name]);
  const err = (k: string) => errors[k] && <p className="mt-1 text-xs text-red-600">{errors[k]}</p>;
  const inCls = (k: string) => `in-a ${errors[k] ? "border-red-400 ring-1 ring-red-300" : ""}`;

  return (
    <div className="space-y-4">
      <div className="sticky top-12 z-30 -mx-1 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-2 shadow-sm backdrop-blur">
        <span className="text-sm text-slate-600">{dirty ? "Unsaved changes" : p.id ? "All changes saved" : "New product"}</span>
        <div className="flex gap-2">
          {dirty && p.id && <button type="button" className="btn-a" onClick={() => location.reload()}>Discard</button>}
          <button type="button" className="btn-a-primary" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        </div>
      </div>
      {msg && <div className={`rounded-lg px-4 py-2.5 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</div>}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Section>
            <label className="block"><span className="lbl">Title</span><input className={inCls("name")} value={p.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. GeForce RTX 4070 Super 12GB" />{err("name")}</label>
            <label className="mt-3 block"><span className="lbl">Title (Arabic)</span><input dir="rtl" className="in-a" value={p.nameAr} onChange={(e) => set("nameAr", e.target.value)} placeholder="اختياري" /></label>
            <label className="mt-3 block"><span className="lbl">Description <span className="font-normal text-slate-400">(supports ## headings, - lists, **bold**)</span></span>
              <textarea className="in-a min-h-32 font-mono text-[13px]" value={p.description} onChange={(e) => set("description", e.target.value)} /></label>
            <label className="mt-3 block"><span className="lbl">Description (Arabic)</span>
              <textarea dir="rtl" className="in-a min-h-24 text-[13px]" value={p.descriptionAr} onChange={(e) => set("descriptionAr", e.target.value)} /></label>
          </Section>

          <Section title="Media">
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {p.images.map((im, i) => (
                <div key={i} className={`group relative rounded-lg border bg-slate-50 p-1 ${i === 0 ? "col-span-2 row-span-2 border-slate-400" : "border-slate-200"}`}>
                  <img src={im.url} alt={im.alt} className="aspect-square w-full rounded object-contain" />
                  <input className="mt-1 w-full rounded border border-slate-200 px-1.5 py-0.5 text-[11px]" placeholder="Alt text" value={im.alt}
                    onChange={(e) => set("images", p.images.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))} />
                  <div className="absolute end-1.5 top-1.5 hidden gap-1 group-hover:flex">
                    <button type="button" className="rounded bg-white px-1.5 text-xs shadow" onClick={() => moveImage(i, -1)} title="Move left">←</button>
                    <button type="button" className="rounded bg-white px-1.5 text-xs shadow" onClick={() => moveImage(i, 1)} title="Move right">→</button>
                    <button type="button" className="rounded bg-white px-1.5 text-xs text-red-600 shadow" onClick={() => set("images", p.images.filter((_, j) => j !== i))} title="Remove">✕</button>
                  </div>
                  {i === 0 && <span className="absolute start-1.5 top-1.5 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">Main</span>}
                </div>
              ))}
              <button type="button" onClick={() => fileRef.current?.click()} className="grid aspect-square place-items-center rounded-lg border-2 border-dashed border-slate-300 text-sm text-slate-500 hover:border-slate-500">
                {uploading ? "Uploading…" : "+ Upload"}
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => uploadFiles(e.target.files)} />
            <div className="mt-3 flex gap-2">
              <input className="in-a" placeholder="…or paste an image URL (https://… or /img/gpu.svg)" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} />
              <button type="button" className="btn-a" disabled={!urlInput.trim()} onClick={() => { set("images", [...p.images, { url: urlInput.trim(), alt: p.name }]); setUrlInput(""); }}>Add</button>
            </div>
          </Section>

          <Section title="Pricing reference">
            <div className="grid gap-3 sm:grid-cols-2">
              <label><span className="lbl">Brand-new price (AED)</span><input type="number" min={0} step="0.01" className={inCls("priceNew")} value={p.priceNew} onChange={(e) => set("priceNew", e.target.value)} />{err("priceNew")}
                <span className="mt-1 block text-xs text-slate-500">Shown on the store as &quot;-x% vs new&quot;. Variant prices are set below.</span></label>
            </div>
          </Section>

          <Section title="Variants" action={options.length < 3 && <button type="button" className="btn-a" onClick={() => updateOptions([...options, { name: options.length ? "" : "Condition", nameAr: "", values: [] }])}>+ Add option</button>}>
            {err("options")}
            {options.length === 0 && <p className="text-sm text-slate-500">This product has a single variant. Add options like Condition, Capacity or Color to create variants.</p>}
            <div className="space-y-3">
              {options.map((o, i) => (
                <OptionEditor key={i} option={o} onChange={(next) => updateOptions(options.map((x, j) => (j === i ? next : x)))} onRemove={() => removeOption(i)} />
              ))}
            </div>
            {err("variants")}
            <BulkApply onApply={(field, value) => { setVariants((vs) => vs.map((v) => ({ ...v, [field]: value }))); setDirty(true); }} />
            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-start">Variant</th><th className="px-2 py-2 text-start">Price</th><th className="px-2 py-2 text-start">Compare-at</th>
                    <th className="px-2 py-2 text-start">Cost</th><th className="px-2 py-2 text-start">SKU</th><th className="px-2 py-2 text-start">Barcode</th>
                    <th className="px-2 py-2 text-start">Stock</th><th className="px-2 py-2 text-start">Weight kg</th><th className="px-2 py-2 text-start" title="Track inventory">Track</th>
                    <th className="px-2 py-2 text-start" title="Continue selling when out of stock">Oversell</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {variants.map((v, i) => {
                    const title = [v.option1, v.option2, v.option3].filter(Boolean).join(" / ") || "Default Title";
                    const price = Number(v.price), cost = Number(v.cost);
                    const margin = price > 0 && v.cost !== "" && v.cost != null ? Math.round(((price - cost) / price) * 100) : null;
                    const cell = (k: keyof VariantInput) => `w-full rounded border px-2 py-1 text-sm ${errors[`variant_${i}_${k}`] ? "border-red-400" : "border-slate-300"}`;
                    return (
                      <tr key={keyOf(v) + i} className="align-top">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <select className="w-12 rounded border border-slate-300 p-0.5 text-[10px]" value={v.image} onChange={(e) => setVariant(i, { image: e.target.value })} title="Variant image">
                              <option value="">img</option>
                              {p.images.map((im, j) => <option key={j} value={im.url}>#{j + 1}</option>)}
                            </select>
                            {v.image && <img src={v.image} alt="" className="h-8 w-8 rounded border object-contain" />}
                            <span className="font-medium">{title}</span>
                          </div>
                        </td>
                        <td className="px-2 py-2"><input type="number" min={0} step="0.01" className={cell("price")} value={v.price} onChange={(e) => setVariant(i, { price: e.target.value })} /></td>
                        <td className="px-2 py-2"><input type="number" min={0} step="0.01" className={cell("comparePrice")} value={v.comparePrice ?? ""} onChange={(e) => setVariant(i, { comparePrice: e.target.value })} /></td>
                        <td className="px-2 py-2"><input type="number" min={0} step="0.01" className={cell("cost")} value={v.cost ?? ""} onChange={(e) => setVariant(i, { cost: e.target.value })} />
                          {margin != null && <span className={`text-[11px] ${margin < 10 ? "text-red-600" : "text-slate-500"}`}>Margin {margin}%</span>}</td>
                        <td className="px-2 py-2"><input className={cell("sku")} value={v.sku} onChange={(e) => setVariant(i, { sku: e.target.value })} /></td>
                        <td className="px-2 py-2"><input className={cell("barcode")} value={v.barcode} onChange={(e) => setVariant(i, { barcode: e.target.value })} /></td>
                        <td className="px-2 py-2"><input type="number" step="1" className={cell("stock")} value={v.stock} onChange={(e) => setVariant(i, { stock: e.target.value })} disabled={!v.trackInventory} /></td>
                        <td className="px-2 py-2"><input type="number" min={0} step="0.01" className={cell("weight")} value={v.weight ?? ""} onChange={(e) => setVariant(i, { weight: e.target.value })} /></td>
                        <td className="px-2 py-2 text-center"><input type="checkbox" checked={v.trackInventory} onChange={(e) => setVariant(i, { trackInventory: e.target.checked })} /></td>
                        <td className="px-2 py-2 text-center"><input type="checkbox" checked={v.continueSelling} onChange={(e) => setVariant(i, { continueSelling: e.target.checked })} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-500">{variants.length} variant(s) · {totalStock} units in stock. Stock changes are recorded in inventory history.</p>
          </Section>

          <Section title="Specifications" action={<button type="button" className="btn-a" onClick={() => set("specs", [...p.specs, { key: "", value: "" }])}>+ Add spec</button>}>
            {p.specs.length === 0 && <p className="text-sm text-slate-500">No specifications yet.</p>}
            <div className="space-y-2">
              {p.specs.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <input className="in-a w-1/3" placeholder="e.g. Memory" value={s.key} onChange={(e) => set("specs", p.specs.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} />
                  <input className="in-a" placeholder="e.g. 12GB GDDR6X" value={s.value} onChange={(e) => set("specs", p.specs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                  <button type="button" className="btn-a" onClick={() => set("specs", p.specs.filter((_, j) => j !== i))} aria-label="Remove">✕</button>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Search engine listing">
            <div className="mb-4 rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">{storeHost} › products › {slugPreview || "handle"}</p>
              <p className="text-lg leading-snug text-[#1a0dab]">{(p.seoTitle || p.name || "Product title").slice(0, 70)}</p>
              <p className="text-sm text-slate-600">{(p.seoDescription || p.description.replace(/[#*_\n]/g, " ") || "Add a description to see how this product might appear in search results.").slice(0, 160)}</p>
            </div>
            <label className="block"><span className="lbl">Page title <span className="font-normal text-slate-400">{(p.seoTitle || "").length}/70</span></span><input className="in-a" value={p.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} placeholder={p.name} /></label>
            <label className="mt-3 block"><span className="lbl">Meta description <span className="font-normal text-slate-400">{(p.seoDescription || "").length}/160</span></span><textarea className="in-a min-h-20" value={p.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} /></label>
            <label className="mt-3 block"><span className="lbl">URL handle</span>
              <div className="flex items-center rounded-lg border border-slate-300 bg-slate-50 ps-3 text-sm text-slate-500">/products/<input className="w-full rounded-e-lg border-0 bg-white px-2 py-2 text-slate-900 outline-none" value={p.slug} onChange={(e) => set("slug", e.target.value)} placeholder={slugPreview} /></div>{err("slug")}</label>
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Status">
            <select className={inCls("status")} value={p.status} onChange={(e) => set("status", e.target.value)}>
              <option value="ACTIVE">Active</option><option value="DRAFT">Draft</option><option value="ARCHIVED">Archived</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">{p.status === "ACTIVE" ? "Visible on the online store." : "Hidden from the online store."}</p>
          </Section>
          <Section title="Product organization">
            <label className="block"><span className="lbl">Category</span>
              <select className={inCls("categoryId")} value={p.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                <option value="">Select…</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>{err("categoryId")}</label>
            <label className="mt-3 block"><span className="lbl">Vendor</span><input className={inCls("brand")} value={p.brand} onChange={(e) => set("brand", e.target.value)} />{err("brand")}</label>
            <label className="mt-3 block"><span className="lbl">Product type</span><input className="in-a" value={p.productType} onChange={(e) => set("productType", e.target.value)} placeholder="e.g. Graphics Card" /></label>
            <label className="mt-3 block"><span className="lbl">Tags</span><input className="in-a" value={p.tags} onChange={(e) => set("tags", e.target.value)} placeholder="comma, separated" /></label>
            {p.tags && <div className="mt-2 flex flex-wrap gap-1">{p.tags.split(",").map((t) => t.trim()).filter(Boolean).map((t) => <span key={t} className="rounded bg-slate-100 px-2 py-0.5 text-xs">{t}</span>)}</div>}
          </Section>
          <Section title="Collections">
            {collections.length === 0 && <p className="text-sm text-slate-500">No manual collections yet.</p>}
            {collections.map((c) => (
              <label key={c.id} className="flex items-center gap-2 py-1 text-sm">
                <input type="checkbox" checked={p.collectionIds.includes(c.id)} onChange={(e) => set("collectionIds", e.target.checked ? [...p.collectionIds, c.id] : p.collectionIds.filter((x) => x !== c.id))} />{c.title}
              </label>
            ))}
            {smartCollections.length > 0 && <p className="mt-2 text-xs text-slate-500">Automatically included in: {smartCollections.join(", ")}</p>}
          </Section>
          <Section title="Merchandising">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.featured} onChange={(e) => set("featured", e.target.checked)} /> Featured / best seller</label>
            <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={p.express} onChange={(e) => set("express", e.target.checked)} /> Express next-day eligible</label>
          </Section>
        </div>
      </div>
      <div className="flex justify-end"><button type="button" className="btn-a-primary" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save"}</button></div>
      <style>{`.lbl{display:block;margin-bottom:.25rem;font-size:.875rem;font-weight:500;color:#334155}`}</style>
    </div>
  );
}

function Section({ title, action, children }: { title?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      {(title || action) && <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">{title}</h2>{action}</div>}
      {children}
    </section>
  );
}

function OptionEditor({ option, onChange, onRemove }: { option: Option; onChange: (o: Option) => void; onRemove: () => void }) {
  const [val, setVal] = useState("");
  const add = () => {
    const parts = val.split(",").map((s) => s.trim()).filter(Boolean).filter((s) => !option.values.includes(s));
    if (parts.length) onChange({ ...option, values: [...option.values, ...parts] });
    setVal("");
  };
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input className="in-a" placeholder="Option name (e.g. Capacity)" value={option.name} onChange={(e) => onChange({ ...option, name: e.target.value })} />
        <input dir="rtl" className="in-a" placeholder="الاسم بالعربية" value={option.nameAr} onChange={(e) => onChange({ ...option, nameAr: e.target.value })} />
        <button type="button" className="btn-a-danger" onClick={onRemove}>Remove</button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {option.values.map((v, i) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium">
            {i > 0 && <button type="button" className="text-slate-400 hover:text-slate-700" onClick={() => { const vs = [...option.values]; [vs[i - 1], vs[i]] = [vs[i], vs[i - 1]]; onChange({ ...option, values: vs }); }} title="Move left">‹</button>}
            {v}
            <button type="button" className="text-slate-400 hover:text-red-600" onClick={() => onChange({ ...option, values: option.values.filter((x) => x !== v) })} aria-label={`Remove ${v}`}>✕</button>
          </span>
        ))}
        <input className="min-w-40 flex-1 rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Add value, press Enter" value={val}
          onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }} onBlur={add} />
      </div>
    </div>
  );
}

function BulkApply({ onApply }: { onApply: (field: "price" | "comparePrice" | "cost" | "stock" | "weight", value: string) => void }) {
  const [field, setField] = useState<"price" | "comparePrice" | "cost" | "stock" | "weight">("price");
  const [value, setValue] = useState("");
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-slate-500">Bulk edit:</span>
      <select className="in-a w-auto py-1" value={field} onChange={(e) => setField(e.target.value as typeof field)}>
        <option value="price">Price</option><option value="comparePrice">Compare-at price</option><option value="cost">Cost</option><option value="stock">Stock</option><option value="weight">Weight</option>
      </select>
      <input type="number" className="in-a w-28 py-1" value={value} onChange={(e) => setValue(e.target.value)} />
      <button type="button" className="btn-a" disabled={value === ""} onClick={() => onApply(field, value)}>Apply to all variants</button>
    </div>
  );
}

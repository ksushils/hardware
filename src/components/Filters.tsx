"use client";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Facets } from "@/lib/catalog";
import { useI18n } from "./I18nProvider";
import { aed, loc } from "@/lib/format";
import { StarIcon } from "./Icons";

/** Revibe/Shopify-style faceted filters: auto-applies on change, keeps the URL shareable. */
export default function Filters({ facets, showCategories }: { facets: Facets; showCategories?: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [brandQ, setBrandQ] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [min, setMin] = useState(sp.get("min") ?? "");
  const [max, setMax] = useState(sp.get("max") ?? "");

  const push = (next: URLSearchParams) => { next.delete("page"); router.push(`${path}?${next.toString()}`, { scroll: false }); };
  const toggle = (key: string, value: string) => {
    const next = new URLSearchParams(sp.toString());
    const all = next.getAll(key);
    next.delete(key);
    (all.includes(value) ? all.filter((v) => v !== value) : [...all, value]).forEach((v) => next.append(key, v));
    push(next);
  };
  const setOne = (key: string, value: string | null) => {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value); else next.delete(key);
    push(next);
  };
  const brands = useMemo(() => facets.brands.filter((b) => b.value.toLowerCase().includes(brandQ.toLowerCase())), [facets.brands, brandQ]);

  // active chips
  const chips: { label: string; key: string; value?: string }[] = [];
  sp.getAll("brand").forEach((v) => chips.push({ label: v, key: "brand", value: v }));
  sp.getAll("cat").forEach((v) => chips.push({ label: loc(locale, facets.categories.find((c) => c.slug === v)?.name ?? v, facets.categories.find((c) => c.slug === v)?.nameAr), key: "cat", value: v }));
  facets.options.forEach((o) => sp.getAll(`o_${o.name}`).forEach((v) => chips.push({ label: `${loc(locale, o.name, o.nameAr)}: ${t.values[v] ?? v}`, key: `o_${o.name}`, value: v })));
  if (sp.get("min") || sp.get("max")) chips.push({ label: `${sp.get("min") || 0}–${sp.get("max") || "∞"} AED`, key: "price" });
  if (sp.get("instock")) chips.push({ label: t.listing.inStockOnly, key: "instock" });
  if (sp.get("rating")) chips.push({ label: `${sp.get("rating")}★+`, key: "rating" });
  const removeChip = (c: (typeof chips)[number]) => {
    if (c.key === "price") { const n = new URLSearchParams(sp.toString()); n.delete("min"); n.delete("max"); setMin(""); setMax(""); return push(n); }
    if (c.value) toggle(c.key, c.value); else setOne(c.key, null);
  };
  const clearAll = () => { const n = new URLSearchParams(); if (sp.get("q")) n.set("q", sp.get("q")!); if (sp.get("sort")) n.set("sort", sp.get("sort")!); setMin(""); setMax(""); push(n); };

  const Section = ({ title, children, open = true }: { title: string; children: React.ReactNode; open?: boolean }) => (
    <details open={open} className="group border-b border-slate-100 py-4 last:border-0">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold">{title}<span className="text-slate-400 transition group-open:rotate-180">⌄</span></summary>
      <div className="mt-3">{children}</div>
    </details>
  );
  const Check = ({ checked, onChange, label, count }: { checked: boolean; onChange: () => void; label: React.ReactNode; count: number }) => (
    <label className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-1.5 py-1.5 text-sm hover:bg-slate-50 ${count === 0 && !checked ? "opacity-40" : ""}`}>
      <span className="flex items-center gap-2"><input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 accent-brand-600" disabled={count === 0 && !checked} />{label}</span>
      <span className="text-xs text-slate-400">{count}</span>
    </label>
  );

  const panel = (
    <div>
      {chips.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5 border-b border-slate-100 pb-4">
          {chips.map((c, i) => <button key={i} onClick={() => removeChip(c)} className="rounded-full bg-ink-900 px-2.5 py-1 text-xs font-semibold text-white">{c.label} ✕</button>)}
          <button onClick={clearAll} className="px-1 text-xs font-semibold text-brand-700 underline">{t.listing.clear}</button>
        </div>
      )}
      {facets.options.map((o) => (
        <Section key={o.name} title={loc(locale, o.name, o.nameAr)}>
          <div className={o.name.toLowerCase() === "condition" ? "space-y-0.5" : "flex flex-wrap gap-1.5"}>
            {o.values.map((v) => {
              const checked = sp.getAll(`o_${o.name}`).includes(v.value);
              return o.name.toLowerCase() === "condition"
                ? <Check key={v.value} checked={checked} onChange={() => toggle(`o_${o.name}`, v.value)} label={t.values[v.value] ?? v.value} count={v.count} />
                : <button key={v.value} onClick={() => toggle(`o_${o.name}`, v.value)} disabled={!v.count && !checked}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${checked ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-300 bg-white hover:border-slate-500"}`}>
                    {t.values[v.value] ?? v.value} <span className="font-normal text-slate-400">({v.count})</span>
                  </button>;
            })}
          </div>
        </Section>
      ))}
      {facets.brands.length > 0 && (
        <Section title={t.listing.brand}>
          {facets.brands.length > 6 && <input value={brandQ} onChange={(e) => setBrandQ(e.target.value)} placeholder={`${t.common.search}…`} className="input mb-2 py-2 text-xs" aria-label={t.listing.brand} />}
          <div className="max-h-56 space-y-0.5 overflow-y-auto">
            {brands.map((b) => <Check key={b.value} checked={sp.getAll("brand").includes(b.value)} onChange={() => toggle("brand", b.value)} label={b.value} count={b.count} />)}
          </div>
        </Section>
      )}
      {showCategories && facets.categories.length > 1 && (
        <Section title={locale === "ar" ? "الفئة" : "Category"}>
          {facets.categories.map((c) => <Check key={c.slug} checked={sp.getAll("cat").includes(c.slug)} onChange={() => toggle("cat", c.slug)} label={loc(locale, c.name, c.nameAr)} count={c.count} />)}
        </Section>
      )}
      <Section title={t.listing.price}>
        <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); const n = new URLSearchParams(sp.toString()); min ? n.set("min", min) : n.delete("min"); max ? n.set("max", max) : n.delete("max"); push(n); }}>
          <input value={min} onChange={(e) => setMin(e.target.value)} type="number" min={0} placeholder={String(facets.priceRange[0])} className="input py-2 text-xs" aria-label={t.listing.min} />
          <span className="text-slate-400">–</span>
          <input value={max} onChange={(e) => setMax(e.target.value)} type="number" min={0} placeholder={String(facets.priceRange[1])} className="input py-2 text-xs" aria-label={t.listing.max} />
          <button className="btn-dark px-3 py-2">→</button>
        </form>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[[0, 500], [500, 1500], [1500, 3000], [3000, 0]].map(([a, b]) => (
            <button key={a} onClick={() => { const n = new URLSearchParams(sp.toString()); n.set("min", String(a)); b ? n.set("max", String(b)) : n.delete("max"); setMin(String(a)); setMax(b ? String(b) : ""); push(n); }}
              className="rounded-full border border-slate-300 px-2.5 py-1 text-xs hover:border-slate-500">{b ? `${aed(a, locale)}–${b}` : `${aed(a, locale)}+`}</button>
          ))}
        </div>
      </Section>
      <Section title={locale === "ar" ? "التوفر والتقييم" : "Availability & rating"}>
        <Check checked={sp.get("instock") === "1"} onChange={() => setOne("instock", sp.get("instock") ? null : "1")} label={t.listing.inStockOnly} count={facets.inStockCount} />
        <div className="mt-2 flex gap-1.5">
          {[4, 3].map((r) => (
            <button key={r} onClick={() => setOne("rating", sp.get("rating") === String(r) ? null : String(r))}
              className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${sp.get("rating") === String(r) ? "border-amber-500 bg-amber-50" : "border-slate-300"}`}>
              <StarIcon filled className="h-3.5 w-3.5 text-amber-400" /> {r}+
            </button>
          ))}
        </div>
      </Section>
    </div>
  );

  return (
    <>
      <button onClick={() => setMobileOpen(true)} className="btn-outline w-full lg:hidden">⚙ {t.listing.filters}{chips.length ? ` (${chips.length})` : ""}</button>
      <aside className="card hidden h-fit p-4 lg:sticky lg:top-36 lg:block">{panel}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 start-0 w-[85%] max-w-sm overflow-y-auto bg-white p-4">
            <div className="mb-2 flex items-center justify-between"><p className="text-lg font-bold">{t.listing.filters}</p><button onClick={() => setMobileOpen(false)} className="text-2xl" aria-label={t.common.close}>×</button></div>
            {panel}
          </div>
        </div>
      )}
    </>
  );
}

export function SortSelect({ value }: { value: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  return (
    <select value={value} aria-label={t.listing.sortBy} className="input w-auto py-2 text-sm"
      onChange={(e) => { const n = new URLSearchParams(sp.toString()); n.set("sort", e.target.value); router.push(`${path}?${n.toString()}`, { scroll: false }); }}>
      <option value="featured">{t.listing.featured}</option>
      <option value="price-asc">{t.listing.priceAsc}</option>
      <option value="price-desc">{t.listing.priceDesc}</option>
      <option value="discount">{t.listing.discount}</option>
      <option value="newest">{t.listing.newest}</option>
      <option value="rating">★ {t.product.reviews}</option>
      <option value="name">{t.listing.name}</option>
    </select>
  );
}

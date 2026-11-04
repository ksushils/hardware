"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "./I18nProvider";
import { SearchIcon } from "./Icons";
import { aed, loc, pctOff } from "@/lib/format";

type Res = { products: { slug: string; name: string; nameAr: string; brand: string; image: string; price: number; priceNew: number }[]; categories: { slug: string; name: string; nameAr: string }[]; total?: number };

export default function LiveSearch() {
  const { t, locale } = useI18n();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Res | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) { setRes(null); return; }
    const ctrl = new AbortController();
    const id = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal }).then((r) => r.json()).then((d) => { setRes(d); setActive(-1); }).catch(() => {});
    }, 180);
    return () => { clearTimeout(id); ctrl.abort(); };
  }, [q]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const items = res?.products ?? [];
  return (
    <div ref={box} className="relative flex-1">
      <form action="/search" onSubmit={(e) => { if (active >= 0 && items[active]) { e.preventDefault(); router.push(`/products/${items[active].slug}`); setOpen(false); } }}>
        <input
          name="q" value={q} autoComplete="off" role="combobox" aria-expanded={open && !!res} aria-controls="search-results"
          onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder={t.common.searchPlaceholder} className="input rounded-full py-2.5 ps-11" aria-label={t.common.search}
        />
        <SearchIcon className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
      </form>
      {open && res && (
        <div id="search-results" role="listbox" className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          {res.categories.length > 0 && (
            <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3">
              {res.categories.map((c) => <Link key={c.slug} href={`/category/${c.slug}`} onClick={() => setOpen(false)} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold hover:bg-slate-200">{loc(locale, c.name, c.nameAr)}</Link>)}
            </div>
          )}
          {items.length === 0 && <p className="p-4 text-sm text-slate-500">{t.listing.noProducts}</p>}
          {items.map((p, i) => {
            const off = pctOff(p.price, p.priceNew);
            return (
              <Link key={p.slug} href={`/products/${p.slug}`} onClick={() => setOpen(false)} role="option" aria-selected={i === active}
                className={`flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 ${i === active ? "bg-slate-50" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image} alt="" className="h-11 w-11 rounded-lg bg-slate-50 object-contain" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{loc(locale, p.name, p.nameAr)}</p>
                  <p className="text-xs text-slate-500">{p.brand}</p>
                </div>
                <div className="text-end">
                  <p className="text-sm font-bold">{aed(p.price, locale)}</p>
                  {off > 0 && <p className="text-xs font-semibold text-accent">-{off}%</p>}
                </div>
              </Link>
            );
          })}
          {(res.total ?? 0) > items.length && (
            <Link href={`/search?q=${encodeURIComponent(q)}`} onClick={() => setOpen(false)} className="block border-t border-slate-100 p-3 text-center text-sm font-semibold text-brand-700 hover:bg-slate-50">
              {t.common.seeAll} ({res.total})
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

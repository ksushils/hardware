"use client";
import { useState } from "react";
import type { MenuItem } from "@/lib/settings";

/** Editable list of menu links, serialised into a hidden JSON input. */
export default function MenuEditor({ name, title, initial, help }: { name: string; title: string; initial: MenuItem[]; help?: string }) {
  const [items, setItems] = useState<MenuItem[]>(initial);
  const set = (i: number, k: keyof MenuItem, v: string) => setItems(items.map((m, j) => (j === i ? { ...m, [k]: v } : m)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
  };
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div><h2 className="text-sm font-semibold">{title}</h2>{help && <p className="text-xs text-slate-500">{help}</p>}</div>
        <button type="button" className="btn-a" onClick={() => setItems([...items, { label: "", labelAr: "", url: "/" }])}>+ Add link</button>
      </div>
      <input type="hidden" name={name} value={JSON.stringify(items)} />
      <div className="divide-y divide-slate-100">
        {items.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-500">No links yet.</p>}
        {items.map((m, i) => (
          <div key={i} className="grid items-center gap-2 px-4 py-2.5 md:grid-cols-[1fr_1fr_1.3fr_auto]">
            <input className="in-a" placeholder="Label" value={m.label} onChange={(e) => set(i, "label", e.target.value)} />
            <input className="in-a" dir="rtl" placeholder="التسمية بالعربية" value={m.labelAr} onChange={(e) => set(i, "labelAr", e.target.value)} />
            <input className="in-a font-mono text-xs" placeholder="/collections/hot-deals" value={m.url} onChange={(e) => set(i, "url", e.target.value)} />
            <div className="flex gap-1">
              <button type="button" className="btn-a px-2" onClick={() => move(i, -1)} aria-label="Move up">↑</button>
              <button type="button" className="btn-a px-2" onClick={() => move(i, 1)} aria-label="Move down">↓</button>
              <button type="button" className="btn-a-danger px-2" onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="Remove">✕</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

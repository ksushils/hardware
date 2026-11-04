"use client";
import { useMemo, useState } from "react";
import { useFormAction } from "@/hooks/useFormAction";
import { saveDiscount } from "@/app/actions/admin/discounts";

type Opt = { id: string; label: string };
export type DiscountInitial = {
  id?: string; title: string; code: string; method: string; type: string; value: number; appliesTo: string; targetIds: string[];
  minType: string; minValue: number; buyQty: number; getQty: number; usageLimit: string; oncePerCustomer: boolean; startsAt: string; endsAt: string; active: boolean; usedCount: number;
};

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function DiscountForm({ initial, products, collections }: { initial: DiscountInitial; products: Opt[]; collections: Opt[] }) {
  const { state, pending, formProps } = useFormAction(saveDiscount);
  const [d, setD] = useState(initial);
  const [filter, setFilter] = useState("");
  const set = <K extends keyof DiscountInitial>(k: K, v: DiscountInitial[K]) => setD((x) => ({ ...x, [k]: v }));
  const pool = d.appliesTo === "PRODUCTS" ? products : collections;
  const shown = pool.filter((o) => o.label.toLowerCase().includes(filter.toLowerCase())).slice(0, 100);

  const summary = useMemo(() => {
    const lines: string[] = [];
    const target = d.appliesTo === "ALL" ? "entire order" : `${d.targetIds.length} ${d.appliesTo === "PRODUCTS" ? "product(s)" : "collection(s)"}`;
    if (d.type === "PERCENT") lines.push(`${d.value || 0}% off ${target}`);
    if (d.type === "FIXED") lines.push(`AED ${d.value || 0} off ${target}`);
    if (d.type === "FREE_SHIPPING") lines.push("Free shipping on the order");
    if (d.type === "BXGY") lines.push(`Buy ${d.buyQty}, get ${d.getQty} at ${d.value >= 100 ? "free" : `${d.value}% off`} (${target})`);
    if (d.minType === "AMOUNT") lines.push(`Minimum purchase of AED ${d.minValue}`);
    if (d.minType === "QUANTITY") lines.push(`Minimum of ${d.minValue} item(s)`);
    if (d.usageLimit) lines.push(`Limit of ${d.usageLimit} total use(s)`);
    if (d.oncePerCustomer) lines.push("One use per customer");
    lines.push(`Active from ${d.startsAt ? new Date(d.startsAt).toLocaleDateString("en-AE") : "today"}${d.endsAt ? ` until ${new Date(d.endsAt).toLocaleDateString("en-AE")}` : ""}`);
    return lines;
  }, [d]);

  const box = "rounded-xl border border-slate-200 bg-white p-4 shadow-sm";
  const lbl = "mb-1 block text-sm font-medium text-slate-700";
  return (
    <form {...formProps} className="grid gap-4 lg:grid-cols-[1fr_300px]">
      {d.id && <input type="hidden" name="id" value={d.id} />}
      <div className="space-y-4">
        <section className={box}>
          <h2 className="mb-3 text-sm font-semibold">Method</h2>
          <div className="mb-3 flex gap-2">
            {["CODE", "AUTOMATIC"].map((m) => (
              <label key={m} className={`flex-1 cursor-pointer rounded-lg border-2 p-3 text-sm ${d.method === m ? "border-slate-900" : "border-slate-200"}`}>
                <input type="radio" name="method" value={m} checked={d.method === m} onChange={() => set("method", m)} className="me-2 accent-slate-900" />
                {m === "CODE" ? "Discount code" : "Automatic discount"}
              </label>
            ))}
          </div>
          {d.method === "CODE" ? (
            <div>
              <label className={lbl}>Discount code</label>
              <div className="flex gap-2">
                <input name="code" value={d.code} onChange={(e) => set("code", e.target.value.toUpperCase())} className="in-a font-mono" placeholder="SUMMER20" />
                <button type="button" className="btn-a whitespace-nowrap" onClick={() => set("code", genCode())}>Generate</button>
              </div>
              <p className="mt-1 text-xs text-slate-500">Customers enter this code at checkout.</p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Applied automatically in the cart when the conditions are met.</p>
          )}
          <label className={`${lbl} mt-3`}>Title (internal{d.method === "AUTOMATIC" ? ", shown to customers" : ""})</label>
          <input name="title" value={d.title} onChange={(e) => set("title", e.target.value)} className="in-a" placeholder="e.g. Ramadan sale" />
        </section>

        <section className={box}>
          <h2 className="mb-3 text-sm font-semibold">Discount type & value</h2>
          <select name="type" value={d.type} onChange={(e) => set("type", e.target.value)} className="in-a mb-3">
            <option value="PERCENT">Percentage off</option>
            <option value="FIXED">Fixed amount off (AED)</option>
            <option value="FREE_SHIPPING">Free shipping</option>
            <option value="BXGY">Buy X get Y</option>
          </select>
          {d.type === "BXGY" && (
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div><label className={lbl}>Customer buys (qty)</label><input name="buyQty" type="number" min={1} value={d.buyQty} onChange={(e) => set("buyQty", Number(e.target.value) || 1)} className="in-a" /></div>
              <div><label className={lbl}>Customer gets (qty)</label><input name="getQty" type="number" min={1} value={d.getQty} onChange={(e) => set("getQty", Number(e.target.value) || 1)} className="in-a" /></div>
            </div>
          )}
          {d.type !== "FREE_SHIPPING" && (
            <div>
              <label className={lbl}>{d.type === "FIXED" ? "Amount (AED)" : d.type === "BXGY" ? "% off the \"get\" items (100 = free)" : "Percentage"}</label>
              <input name="value" type="number" step="0.01" min={0} value={d.value} onChange={(e) => set("value", Number(e.target.value))} className="in-a" />
            </div>
          )}
          {d.type !== "FREE_SHIPPING" && <>
            <label className={`${lbl} mt-4`}>Applies to</label>
            <select name="appliesTo" value={d.appliesTo} onChange={(e) => { set("appliesTo", e.target.value); set("targetIds", []); }} className="in-a">
              <option value="ALL">All products</option><option value="COLLECTIONS">Specific collections</option><option value="PRODUCTS">Specific products</option>
            </select>
            {d.appliesTo !== "ALL" && (
              <div className="mt-2 rounded-lg border border-slate-200">
                <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={`Search ${d.appliesTo === "PRODUCTS" ? "products" : "collections"}`} className="w-full rounded-t-lg border-b border-slate-200 px-3 py-2 text-sm outline-none" />
                <div className="max-h-56 overflow-y-auto p-2">
                  {shown.map((o) => (
                    <label key={o.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50">
                      <input type="checkbox" name="targetIds" value={o.id} checked={d.targetIds.includes(o.id)} onChange={(e) => set("targetIds", e.target.checked ? [...d.targetIds, o.id] : d.targetIds.filter((x) => x !== o.id))} className="accent-slate-900" />
                      {o.label}
                    </label>
                  ))}
                  {/* keep hidden selections that are filtered out */}
                  {d.targetIds.filter((id) => !shown.some((o) => o.id === id)).map((id) => <input key={id} type="hidden" name="targetIds" value={id} />)}
                </div>
                <p className="border-t border-slate-100 px-3 py-1.5 text-xs text-slate-500">{d.targetIds.length} selected</p>
              </div>
            )}
          </>}
        </section>

        <section className={box}>
          <h2 className="mb-3 text-sm font-semibold">Minimum purchase requirements</h2>
          {[["NONE", "No minimum requirements"], ["AMOUNT", "Minimum purchase amount (AED)"], ["QUANTITY", "Minimum quantity of items"]].map(([k, l]) => (
            <label key={k} className="flex items-center gap-2 py-1 text-sm"><input type="radio" name="minType" value={k} checked={d.minType === k} onChange={() => set("minType", k)} className="accent-slate-900" />{l}</label>
          ))}
          {d.minType !== "NONE" && <input name="minValue" type="number" min={0} step="0.01" value={d.minValue} onChange={(e) => set("minValue", Number(e.target.value))} className="in-a mt-2 w-48" />}
        </section>

        <section className={box}>
          <h2 className="mb-3 text-sm font-semibold">Usage limits</h2>
          <label className={lbl}>Total number of uses (leave empty for unlimited)</label>
          <input name="usageLimit" type="number" min={1} value={d.usageLimit} onChange={(e) => set("usageLimit", e.target.value)} className="in-a w-48" />
          <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" name="oncePerCustomer" checked={d.oncePerCustomer} onChange={(e) => set("oncePerCustomer", e.target.checked)} className="accent-slate-900" /> Limit to one use per customer (by email)</label>
        </section>

        <section className={box}>
          <h2 className="mb-3 text-sm font-semibold">Active dates</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={lbl}>Start</label><input name="startsAt" type="datetime-local" value={d.startsAt} onChange={(e) => set("startsAt", e.target.value)} className="in-a" /></div>
            <div><label className={lbl}>End (optional)</label><input name="endsAt" type="datetime-local" value={d.endsAt} onChange={(e) => set("endsAt", e.target.value)} className="in-a" /></div>
          </div>
        </section>
      </div>

      <div className="space-y-4">
        <section className={`${box} lg:sticky lg:top-16`}>
          <h2 className="mb-2 text-sm font-semibold">Summary</h2>
          <p className="font-mono text-sm font-bold">{d.method === "CODE" ? d.code || "No code yet" : d.title || "Automatic discount"}</p>
          <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-slate-600">{summary.map((l) => <li key={l}>{l}</li>)}</ul>
          {d.id && <p className="mt-3 text-xs text-slate-500">Used {d.usedCount} time(s)</p>}
          <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" name="active" checked={d.active} onChange={(e) => set("active", e.target.checked)} className="accent-slate-900" /> Active</label>
          {state?.error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
          <button className="btn-a-primary mt-4 w-full py-2" disabled={pending}>{pending ? "Saving…" : "Save discount"}</button>
        </section>
      </div>
    </form>
  );
}

"use client";
import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { useFormAction } from "@/hooks/useFormAction";
import { saveDraft, searchCustomers, searchVariants } from "@/app/actions/admin/drafts";
import { computeTotals, warrantyPrice, type PricingConfig } from "@/lib/pricing";
import { aed, EMIRATES } from "@/lib/format";

export type DraftLine = { variantId: string; name: string; variantTitle: string; price: number; stock: number; tracked: boolean; image: string; sku: string | null; quantity: number; warranty: boolean };
type Rate = { id: string; name: string; price: number; freeAbove: number | null };
export type DraftInitial = {
  number?: string; email: string; fullName: string; phone: string; emirate: string; area: string; street: string; building: string;
  lines: DraftLine[]; discountType: "none" | "amount" | "percent"; discountValue: number; discountReason: string;
  shippingRateId: string; customShipping: number; customShippingName: string; note: string; tags: string;
};
type VariantHit = Omit<DraftLine, "quantity" | "warranty">;
type CustomerHit = { id: string; name: string; email: string; phone: string; address: { fullName: string; phone: string; emirate: string; area: string; street: string; building: string } | null };

export default function DraftForm({ initial, rates, cfg }: { initial: DraftInitial; rates: Rate[]; cfg: PricingConfig }) {
  const { state, pending, formProps } = useFormAction(saveDraft);
  const [d, setD] = useState<DraftInitial>(initial);
  const [vq, setVq] = useState("");
  const [vHits, setVHits] = useState<VariantHit[]>([]);
  const [cq, setCq] = useState("");
  const [cHits, setCHits] = useState<CustomerHit[]>([]);
  const [searching, start] = useTransition();
  const set = <K extends keyof DraftInitial>(k: K, v: DraftInitial[K]) => setD((x) => ({ ...x, [k]: v }));

  const totals = useMemo(() => {
    const lines = d.lines.map((l) => ({ price: l.price, quantity: l.quantity, warranty: l.warranty }));
    const pre = computeTotals(lines, { cfg });
    const discount = d.discountType === "amount" ? d.discountValue : d.discountType === "percent" ? Math.round(pre.subtotal * Math.min(d.discountValue, 100)) / 100 : 0;
    const r = d.shippingRateId === "custom" ? { price: d.customShipping, freeAbove: null } : rates.find((x) => x.id === d.shippingRateId) ?? null;
    return computeTotals(lines, { rate: r, discount, cfg });
  }, [d, rates, cfg]);

  const addVariant = (h: VariantHit) => {
    setD((x) => {
      const ex = x.lines.find((l) => l.variantId === h.variantId);
      return { ...x, lines: ex ? x.lines.map((l) => (l.variantId === h.variantId ? { ...l, quantity: l.quantity + 1 } : l)) : [...x.lines, { ...h, quantity: 1, warranty: false }] };
    });
    setVHits([]);
    setVq("");
  };
  const pickCustomer = (c: CustomerHit) => {
    setD((x) => ({
      ...x, email: c.email, fullName: c.address?.fullName || c.name, phone: c.address?.phone || c.phone,
      ...(c.address ? { emirate: c.address.emirate, area: c.address.area, street: c.address.street, building: c.address.building } : {}),
    }));
    setCHits([]);
    setCq("");
  };

  return (
    <form {...formProps} className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <input type="hidden" name="payload" value={JSON.stringify({ ...d, lines: d.lines.map(({ variantId, quantity, warranty }) => ({ variantId, quantity, warranty })) })} />
      <div className="space-y-4">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Products</h2>
          <div className="relative">
            <input
              value={vq}
              onChange={(e) => {
                const q = e.target.value;
                setVq(q);
                start(async () => setVHits(q.length >= 2 ? await searchVariants(q) : []));
              }}
              placeholder="Search products by name, brand or SKU"
              className="in-a"
            />
            {vHits.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                {vHits.map((h) => (
                  <li key={h.variantId}>
                    <button type="button" onClick={() => addVariant(h)} className="flex w-full items-center gap-3 px-3 py-2 text-start text-sm hover:bg-slate-50">
                      <span className="relative h-9 w-9 shrink-0 rounded bg-slate-50"><Image src={h.image || "/img/gpu.svg"} alt="" fill className="object-contain p-0.5" unoptimized /></span>
                      <span className="flex-1">{h.name}<span className="block text-xs text-slate-500">{h.variantTitle} {h.sku && `· ${h.sku}`}</span></span>
                      <span className="text-end text-xs">{aed(h.price)}<span className={`block ${h.tracked && h.stock <= 0 ? "text-red-600" : "text-slate-500"}`}>{h.tracked ? `${h.stock} in stock` : "Not tracked"}</span></span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {searching && <span className="absolute end-3 top-2.5 text-xs text-slate-400">Searching…</span>}
          </div>
          {d.lines.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No products added yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {d.lines.map((l, idx) => (
                <li key={l.variantId} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                  <span className="relative h-10 w-10 shrink-0 rounded bg-slate-50"><Image src={l.image || "/img/gpu.svg"} alt="" fill className="object-contain p-0.5" unoptimized /></span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{l.name}</p>
                    <p className="text-xs text-slate-500">{l.variantTitle} · {aed(l.price)}{l.tracked && l.quantity > l.stock && <span className="text-red-600"> · only {l.stock} in stock</span>}</p>
                    <label className="mt-1 flex items-center gap-1.5 text-xs">
                      <input type="checkbox" checked={l.warranty} onChange={(e) => set("lines", d.lines.map((x, i) => (i === idx ? { ...x, warranty: e.target.checked } : x)))} className="accent-slate-900" />
                      Care+ warranty (+{aed(warrantyPrice(l.price, cfg))}/unit)
                    </label>
                  </div>
                  <input type="number" min={1} value={l.quantity} onChange={(e) => set("lines", d.lines.map((x, i) => (i === idx ? { ...x, quantity: Math.max(1, Number(e.target.value) || 1) } : x)))} className="in-a w-20" />
                  <span className="w-24 text-end font-medium">{aed((l.price + (l.warranty ? warrantyPrice(l.price, cfg) : 0)) * l.quantity)}</span>
                  <button type="button" onClick={() => set("lines", d.lines.filter((_, i) => i !== idx))} className="text-slate-400 hover:text-red-600" aria-label="Remove">✕</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Payment</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm"><span className="mb-1 block font-medium">Discount</span>
              <select value={d.discountType} onChange={(e) => set("discountType", e.target.value as DraftInitial["discountType"])} className="in-a">
                <option value="none">No discount</option><option value="amount">Amount (AED)</option><option value="percent">Percentage (%)</option>
              </select>
            </label>
            {d.discountType !== "none" && <>
              <label className="text-sm"><span className="mb-1 block font-medium">Value</span><input type="number" min={0} step="0.01" value={d.discountValue} onChange={(e) => set("discountValue", Number(e.target.value) || 0)} className="in-a" /></label>
              <label className="text-sm"><span className="mb-1 block font-medium">Reason</span><input value={d.discountReason} onChange={(e) => set("discountReason", e.target.value)} className="in-a" placeholder="Loyal customer" /></label>
            </>}
            <label className="text-sm sm:col-span-1"><span className="mb-1 block font-medium">Shipping</span>
              <select value={d.shippingRateId} onChange={(e) => set("shippingRateId", e.target.value)} className="in-a">
                <option value="">No shipping (pickup)</option>
                {rates.map((r) => <option key={r.id} value={r.id}>{r.name}: {aed(r.price)}{r.freeAbove != null ? ` (free over ${aed(r.freeAbove)})` : ""}</option>)}
                <option value="custom">Custom rate…</option>
              </select>
            </label>
            {d.shippingRateId === "custom" && <>
              <label className="text-sm"><span className="mb-1 block font-medium">Rate name</span><input value={d.customShippingName} onChange={(e) => set("customShippingName", e.target.value)} className="in-a" placeholder="Courier" /></label>
              <label className="text-sm"><span className="mb-1 block font-medium">Price (AED)</span><input type="number" min={0} step="0.01" value={d.customShipping} onChange={(e) => set("customShipping", Number(e.target.value) || 0)} className="in-a" /></label>
            </>}
          </div>
          <dl className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{aed(totals.subtotal)}</dd></div>
            {totals.discount > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>− {aed(totals.discount)}</dd></div>}
            <div className="flex justify-between"><dt>Shipping</dt><dd>{totals.shipping ? aed(totals.shipping) : "Free"}</dd></div>
            <div className="flex justify-between text-slate-500"><dt>VAT (included)</dt><dd>{aed(totals.vat)}</dd></div>
            <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold"><dt>Total</dt><dd>{aed(totals.total)}</dd></div>
          </dl>
        </section>
      </div>

      <div className="space-y-4">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Customer</h2>
          <div className="relative mb-3">
            <input value={cq} onChange={(e) => { const q = e.target.value; setCq(q); start(async () => setCHits(q.length >= 2 ? await searchCustomers(q) : [])); }} placeholder="Search existing customers" className="in-a" />
            {cHits.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
                {cHits.map((c) => <li key={c.id}><button type="button" onClick={() => pickCustomer(c)} className="w-full px-3 py-2 text-start text-sm hover:bg-slate-50">{c.name}<span className="block text-xs text-slate-500">{c.email}</span></button></li>)}
              </ul>
            )}
          </div>
          <div className="space-y-2">
            <input value={d.email} onChange={(e) => set("email", e.target.value)} placeholder="Email" type="email" className="in-a" />
            <input value={d.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="Full name" className="in-a" />
            <input value={d.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Phone (05X XXX XXXX)" className="in-a" />
          </div>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Shipping address</h2>
          <div className="space-y-2">
            <select value={d.emirate} onChange={(e) => set("emirate", e.target.value)} className="in-a">{EMIRATES.map((e) => <option key={e}>{e}</option>)}</select>
            <input value={d.area} onChange={(e) => set("area", e.target.value)} placeholder="Area / community" className="in-a" />
            <input value={d.street} onChange={(e) => set("street", e.target.value)} placeholder="Street" className="in-a" />
            <input value={d.building} onChange={(e) => set("building", e.target.value)} placeholder="Building / villa & apt" className="in-a" />
          </div>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Notes & tags</h2>
          <textarea value={d.note} onChange={(e) => set("note", e.target.value)} rows={3} placeholder="Internal note" className="in-a mb-2" />
          <input value={d.tags} onChange={(e) => set("tags", e.target.value)} placeholder="Tags, comma separated" className="in-a" />
        </section>
        {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        <button className="btn-a-primary w-full py-2" disabled={pending}>{pending ? "Saving…" : d.number ? "Save draft" : "Create draft"}</button>
      </div>
    </form>
  );
}

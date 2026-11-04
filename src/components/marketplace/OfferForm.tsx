"use client";
import { useState } from "react";
import { useFormAction } from "@/hooks/useFormAction";
import { saveOffer } from "@/app/actions/sellerOffers";
import OfferTermsFields, { type OfferTermsInitial } from "./OfferTermsFields";

type Opt = { name: string; values: string[] };
export type OfferInitial = { id?: string; options: (string | null)[]; sku: string; price: string; stock: string; approvalStatus?: string; rejectionReason?: string | null; terms: OfferTermsInitial };

export default function OfferForm({ product, options, initial, minReturnDays, priceNew }: {
  product: { id: string; name: string; image: string }; options: Opt[]; initial: OfferInitial; minReturnDays: number; priceNew: number;
}) {
  const { state, pending, formProps } = useFormAction(saveOffer);
  const [vals, setVals] = useState(initial.options);
  return (
    <form {...formProps} className="space-y-5">
      <input type="hidden" name="productId" value={product.id} />
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {initial.approvalStatus === "REJECTED" && initial.rejectionReason && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700"><b>Changes requested:</b> {initial.rejectionReason}</p>}
      {initial.approvalStatus === "APPROVED" && <p className="rounded-lg bg-sky-50 p-3 text-sm text-sky-800">This offer is live. Price and stock changes go live instantly; changes to condition, evidence, photos, warranty or returns are re-reviewed by the marketplace team.</p>}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={product.image} alt="" className="h-14 w-14 rounded-lg border bg-slate-50 object-contain" />
          <div><p className="text-xs text-slate-500">You are selling</p><p className="font-semibold">{product.name}</p></div>
        </div>
        <h2 className="mb-2 text-sm font-semibold">Specification & price</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {options.map((o, i) => (
            <label key={o.name}><span className="label">{o.name === "Title" ? "Version" : o.name} *</span>
              <select name={`option${i + 1}`} value={vals[i] ?? ""} onChange={(e) => setVals(vals.map((x, j) => (j === i ? e.target.value : x)))} required className="in-a">
                <option value="" disabled>Choose…</option>{o.values.map((v) => <option key={v}>{v}</option>)}
              </select>
            </label>
          ))}
          <label><span className="label">Your price (AED, VAT included) *</span><input name="price" type="number" step="0.01" min="0.01" defaultValue={initial.price} required className="in-a" />{priceNew > 0 && <span className="mt-1 block text-xs text-slate-500">New price reference: AED {priceNew}</span>}</label>
          <label><span className="label">Stock *</span><input name="stock" type="number" min={0} defaultValue={initial.stock} required className="in-a" /></label>
          <label><span className="label">Your SKU</span><input name="sku" defaultValue={initial.sku} className="in-a" /></label>
        </div>
        <p className="mt-2 text-xs text-slate-500">Condition values come from the product&apos;s options. Cosmetic grade and the commercial condition of YOUR unit are declared below.</p>
      </section>

      <OfferTermsFields initial={initial.terms} minReturnDays={minReturnDays} />

      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{state.error}</p>}
      <div className="sticky bottom-0 flex gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
        <button className="btn-a-primary" disabled={pending}>{pending ? "Saving…" : initial.id ? "Save offer" : "Submit offer"}</button>
      </div>
    </form>
  );
}

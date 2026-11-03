"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { addToCart } from "@/app/actions/cart";
import { CONDITIONS, type Condition, aed, pctOff } from "@/lib/format";
import { installment, warrantyPrice } from "@/lib/pricing";

type V = { id: string; condition: string; price: number; stock: number };

export default function BuyBox({ variants, priceNew, express }: { variants: V[]; priceNew: number; express: boolean }) {
  const initial = variants.find((v) => v.stock > 0) ?? variants[0];
  const [selected, setSelected] = useState(initial.id);
  const [warranty, setWarranty] = useState(false);
  const v = variants.find((x) => x.id === selected)!;
  const off = pctOff(v.price, priceNew);
  const wp = warrantyPrice(v.price);
  const info = CONDITIONS[v.condition as Condition];

  return (
    <form action={addToCart} className="space-y-5">
      <input type="hidden" name="variantId" value={v.id} />
      <div>
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-black">{aed(v.price)}</span>
          {off > 0 && <span className="rounded-full bg-red-50 px-2.5 py-1 text-sm font-bold text-accent">-{off}% vs new</span>}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          <span className="line-through">{aed(priceNew)}</span> brand new · VAT included
        </p>
        <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
          Pay in 4 interest-free payments of <b>{aed(installment(v.price))}</b>
        </p>
      </div>

      <div>
        <p className="label">Condition</p>
        <div className="grid grid-cols-2 gap-2">
          {variants.map((x) => {
            const c = CONDITIONS[x.condition as Condition];
            const disabled = x.stock <= 0;
            return (
              <button
                type="button" key={x.id} disabled={disabled} onClick={() => setSelected(x.id)}
                className={`rounded-xl border-2 p-3 text-left transition ${x.id === selected ? "border-brand-600 bg-brand-50" : "border-slate-200 bg-white hover:border-slate-400"} ${disabled ? "opacity-40" : ""}`}
              >
                <p className="text-sm font-bold">{c?.label ?? x.condition}</p>
                <p className="text-sm">{aed(x.price)}</p>
                <p className="text-xs text-slate-500">{disabled ? "Sold out" : x.stock <= 3 ? `Only ${x.stock} left` : "In stock"}</p>
              </button>
            );
          })}
        </div>
        {info && <p className="mt-2 text-sm text-slate-600">{info.desc}</p>}
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3">
        <input type="checkbox" name="warranty" checked={warranty} onChange={(e) => setWarranty(e.target.checked)} className="mt-1 accent-brand-600" />
        <span className="text-sm">
          <b>Add TechRevive Care+ (+{aed(wp)})</b><br />
          <span className="text-slate-600">Extends your warranty to 24 months, with express replacement.</span>
        </span>
      </label>

      <div className="flex gap-3">
        <select name="quantity" className="input w-24" defaultValue="1" aria-label="Quantity">
          {Array.from({ length: Math.min(10, Math.max(1, v.stock)) }, (_, i) => <option key={i + 1}>{i + 1}</option>)}
        </select>
        <Submit disabled={v.stock <= 0} />
      </div>
      <BuyNow disabled={v.stock <= 0} />

      <ul className="space-y-1.5 text-sm text-slate-600">
        <li>🚚 {express ? "Express: order by 3 PM for next-day delivery" : "Free delivery in 2–4 business days (orders over AED 200)"}</li>
        <li>🛡️ 12-month warranty {v.condition === "NEW" ? "(manufacturer)" : "(TechRevive)"}</li>
        <li>↩️ 14-day free returns</li>
        <li>💵 Cash on delivery available</li>
      </ul>
    </form>
  );
}

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return <button className="btn-primary flex-1" disabled={disabled || pending}>{pending ? "Adding..." : disabled ? "Sold out" : "Add to cart"}</button>;
}
function BuyNow({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return <button name="buyNow" value="1" className="btn-dark w-full" disabled={disabled || pending}>Buy now</button>;
}

"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { addToCart } from "@/app/actions/cart";
import { requestStockAlert } from "@/app/actions/account";
import { useFormAction } from "@/hooks/useFormAction";
import { aed, loc, pctOff } from "@/lib/format";
import { installment, warrantyPrice, type PricingConfig } from "@/lib/pricing";
import { isAvailable, maxQty, newPriceFor } from "@/lib/inventory";
import { useI18n, fmt } from "./I18nProvider";
import DeliveryCountdown from "./DeliveryCountdown";

type V = { id: string; title: string; option1: string | null; option2: string | null; option3: string | null; price: number; comparePrice: number | null; stock: number; trackInventory: boolean; continueSelling: boolean; sku: string | null; image: string | null };
type O = { name: string; nameAr: string; values: string[] };
const KEYS = ["option1", "option2", "option3"] as const;

export default function BuyBox({ variants, options, priceNew, express, name, cfg, codEnabled, onImage }: {
  variants: V[]; options: O[]; priceNew: number; express: boolean; name: string; cfg: PricingConfig; codEnabled: boolean; onImage?: string;
}) {
  const { t, locale } = useI18n();
  const initial = variants.find(isAvailable) ?? variants[0];
  const [sel, setSel] = useState<(string | null)[]>(KEYS.map((k) => initial[k]));
  const [warranty, setWarranty] = useState(false);
  const [sticky, setSticky] = useState(false);
  const buttonsRef = useRef<HTMLDivElement>(null);

  const v = useMemo(() => variants.find((x) => KEYS.every((k, i) => i >= options.length || x[k] === sel[i])) ?? null, [variants, sel, options.length]);
  const available = !!v && isAvailable(v);
  const isCondition = (o: O) => o.name.toLowerCase() === "condition";

  useEffect(() => {
    const el = buttonsRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setSticky(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (v?.image) window.dispatchEvent(new CustomEvent("tr-variant-image", { detail: v.image }));
  }, [v?.image]);

  // can this value be chosen given the other current selections?
  const valueState = (oi: number, value: string) => {
    const matches = variants.filter((x) => x[KEYS[oi]] === value && KEYS.every((k, i) => i === oi || i >= options.length || !sel[i] || x[k] === sel[i]));
    const anyMatch = variants.filter((x) => x[KEYS[oi]] === value);
    return { exists: anyMatch.length > 0, available: matches.some(isAvailable), price: matches[0]?.price ?? anyMatch[0]?.price };
  };
  const choose = (oi: number, value: string) => {
    const next = [...sel];
    next[oi] = value;
    // if combination doesn't exist, pick the first available variant with that value
    if (!variants.some((x) => KEYS.every((k, i) => i >= options.length || x[k] === next[i]))) {
      const alt = variants.find((x) => x[KEYS[oi]] === value && isAvailable(x)) ?? variants.find((x) => x[KEYS[oi]] === value);
      if (alt) KEYS.forEach((k, i) => (next[i] = alt[k]));
    }
    setSel(next);
  };

  const price = v?.price ?? initial.price;
  const condIdx = Math.max(0, options.findIndex(isCondition));
  const refNew = newPriceFor(v ?? initial, variants, priceNew, condIdx);
  const off = pctOff(price, refNew);
  const wp = warrantyPrice(price, cfg);
  const condValue = options.findIndex(isCondition) >= 0 ? sel[options.findIndex(isCondition)] : null;
  const showOptions = !(options.length === 1 && options[0].values.length === 1 && options[0].values[0] === "Default Title");

  return (
    <div className="space-y-5">
      <form id="buybox" action={addToCart} className="space-y-5">
        <input type="hidden" name="variantId" value={v?.id ?? ""} />
        <div>
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="text-3xl font-black">{aed(price, locale)}</span>
            {off > 0 && <span className="rounded-full bg-red-50 px-2.5 py-1 text-sm font-bold text-accent">{fmt(t.product.vsNew, { n: off })}</span>}
          </div>
          {refNew > price && <p className="mt-1 text-sm text-slate-500"><span className="line-through">{aed(refNew, locale)}</span> {t.product.brandNew} · {t.common.vatIncluded}</p>}
          {refNew > price && <p className="mt-1 text-sm font-semibold text-brand-700">{locale === "ar" ? `وفّر ${aed(refNew - price, locale)}` : `You save ${aed(refNew - price, locale)}`}</p>}
          <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{t.product.payIn4} <b>{aed(installment(price), locale)}</b></p>
        </div>

        {showOptions && options.map((o, oi) => (
          <fieldset key={o.name}>
            <legend className="label">{loc(locale, o.name, o.nameAr)}: <span className="font-normal text-slate-500">{sel[oi] ? t.values[sel[oi]!] ?? sel[oi] : ""}</span></legend>
            <div className={isCondition(o) ? "grid grid-cols-2 gap-2" : "flex flex-wrap gap-2"}>
              {o.values.map((val) => {
                const st = valueState(oi, val);
                if (!st.exists) return null;
                const active = sel[oi] === val;
                return isCondition(o) ? (
                  <button type="button" key={val} onClick={() => choose(oi, val)} aria-pressed={active}
                    className={`rounded-xl border-2 p-3 text-start transition ${active ? "border-brand-600 bg-brand-50" : "border-slate-200 bg-white hover:border-slate-400"} ${!st.available ? "opacity-50" : ""}`}>
                    <p className="text-sm font-bold">{t.values[val] ?? val}</p>
                    {st.price != null && <p className="text-sm">{aed(st.price, locale)}</p>}
                    <p className="text-xs text-slate-500">{st.available ? t.common.inStock : t.common.soldOut}</p>
                  </button>
                ) : (
                  <button type="button" key={val} onClick={() => choose(oi, val)} aria-pressed={active}
                    className={`rounded-xl border-2 px-4 py-2 text-sm font-semibold transition ${active ? "border-brand-600 bg-brand-50" : "border-slate-200 bg-white hover:border-slate-400"} ${!st.available ? "text-slate-400 line-through" : ""}`}>
                    {t.values[val] ?? val}
                  </button>
                );
              })}
            </div>
            {isCondition(o) && condValue && t.conditionDesc[condValue] && <p className="mt-2 text-sm text-slate-600">{t.conditionDesc[condValue]}</p>}
          </fieldset>
        ))}

        {v && available && v.trackInventory && !v.continueSelling && v.stock <= 3 && (
          <p className="text-sm font-semibold text-amber-600">⚠ {fmt(t.common.onlyLeft, { n: v.stock })}</p>
        )}

        {available && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3">
            <input type="checkbox" name="warranty" checked={warranty} onChange={(e) => setWarranty(e.target.checked)} className="mt-1 accent-brand-600" />
            <span className="text-sm"><b>{fmt(t.product.carePlus, { amount: aed(wp, locale) })}</b><br /><span className="text-slate-600">{t.product.carePlusText}</span></span>
          </label>
        )}

        <div ref={buttonsRef} className="space-y-3">
          {available ? (
            <>
              <div className="flex gap-3">
                <select name="quantity" className="input w-24" defaultValue="1" aria-label={t.product.quantity}>
                  {Array.from({ length: Math.max(1, v ? maxQty(v) : 1) }, (_, i) => <option key={i + 1}>{i + 1}</option>)}
                </select>
                <Submit label={t.product.addToCart} pendingLabel={t.product.adding} />
              </div>
              <BuyNow label={t.product.buyNow} />
            </>
          ) : (
            <button type="button" disabled className="btn w-full bg-slate-200 text-slate-500">{v ? t.common.soldOut : t.product.unavailable}</button>
          )}
        </div>
      </form>

      {v && !available && <StockAlert variantId={v.id} />}

      {express && available && <DeliveryCountdown />}
      <ul className="space-y-1.5 text-sm text-slate-600">
        <li>🚚 {express ? t.product.shipExpress : t.product.shipStandard}</li>
        <li>🛡️ {condValue === "Brand New" ? t.product.warrantyMfr : t.product.warrantyOurs}</li>
        <li>↩️ {t.product.freeReturns}</li>
        {codEnabled && <li>💵 {t.product.cod}</li>}
        {v?.sku && <li className="text-xs text-slate-400">{t.product.sku}: {v.sku}</li>}
      </ul>

      {/* Sticky add-to-cart bar */}
      <div className={`fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 shadow-2xl backdrop-blur transition-transform ${sticky ? "translate-y-0" : "translate-y-full"}`} aria-hidden={!sticky}>
        <div className="container-x flex items-center gap-3 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {onImage && <img src={onImage} alt="" className="hidden h-11 w-11 rounded-lg bg-slate-50 object-contain sm:block" />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="text-sm"><b>{aed(price, locale)}</b> {v && showOptions && <span className="text-slate-500">· {v.title.split(" / ").map((x) => t.values[x] ?? x).join(" / ")}</span>}</p>
          </div>
          {available ? <button form="buybox" className="btn-primary me-16" tabIndex={sticky ? 0 : -1}>{t.product.addToCart}</button> : <span className="me-16 text-sm text-slate-500">{t.common.soldOut}</span>}
        </div>
      </div>
    </div>
  );
}

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return <button className="btn-primary flex-1" disabled={pending}>{pending ? pendingLabel : label}</button>;
}
function BuyNow({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button name="buyNow" value="1" className="btn-dark w-full" disabled={pending}>{label}</button>;
}

function StockAlert({ variantId }: { variantId: string }) {
  const { t } = useI18n();
  const { state, pending, formProps } = useFormAction(requestStockAlert);
  return (
    <form {...formProps} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-bold">🔔 {t.product.notifyMe}</p>
      <p className="mt-1 text-xs text-slate-600">{t.product.notifyText}</p>
      <input type="hidden" name="variantId" value={variantId} />
      {state?.ok ? <p className="mt-3 text-sm font-semibold text-brand-700">✓ {state.ok}</p> : (
        <div className="mt-3 flex gap-2">
          <input name="email" type="email" required placeholder={t.footer.emailPh} className="input py-2" aria-label={t.common.email} />
          <button className="btn-dark py-2" disabled={pending}>{t.common.submit}</button>
        </div>
      )}
      {state?.error && <p className="mt-2 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

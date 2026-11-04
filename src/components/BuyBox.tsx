"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { addToCart } from "@/app/actions/cart";
import { requestStockAlert } from "@/app/actions/account";
import { useFormAction } from "@/hooks/useFormAction";
import { aed, loc, pctOff } from "@/lib/format";
import { installment, warrantyPrice, type PricingConfig } from "@/lib/pricing";
import { maxQty } from "@/lib/inventory";
import {
  CONDITION_TYPE_LABEL, EVIDENCE_LABEL, L, REASON_TEXT, WARRANTY_PROVIDER_LABEL, effectiveCondition, evidenceLevel, offerAvailable, rankOffers, referenceNewPrice,
  type EvidenceLevel, type RankedOffer,
} from "@/lib/offers";
import { useI18n, fmt } from "./I18nProvider";
import DeliveryCountdown from "./DeliveryCountdown";

export type BuyOffer = {
  id: string; title: string; option1: string | null; option2: string | null; option3: string | null; price: number; comparePrice: number | null;
  stock: number; trackInventory: boolean; continueSelling: boolean; sku: string | null; image: string | null;
  sellerId: string | null; seller: { id: string; shopName: string; slug: string; status: string; vacationMode: boolean; ratingAvg: number; ratingCount: number } | null;
  conditionType: string | null; cosmeticGrade: string | null; functionalStatus: string | null; batteryHealth: number | null; batteryCycles: number | null;
  repairDisclosure: string | null; accessories: string | null; verification: string; testedAt: string | null; testedBy: string | null; testNotes: string | null;
  photos: string[]; warrantyProvider: string | null; warrantyMonths: number | null; warrantyTerms: string | null; returnDays: number | null; returnTerms: string | null; handlingDays: number;
};
type O = { name: string; nameAr: string; values: string[] };
const KEYS = ["option1", "option2", "option3"] as const;

export default function BuyBox({ variants, options, priceNew, express, name, cfg, codEnabled, onImage, defaults, batteryRelevant }: {
  variants: BuyOffer[]; options: O[]; priceNew: number; express: boolean; name: string; cfg: PricingConfig; codEnabled: boolean; onImage?: string;
  defaults: { warrantyMonths: number; returnDays: number; storeName: string; storeNameAr: string }; batteryRelevant: boolean;
}) {
  const { t, locale } = useI18n();
  const ar = locale === "ar";
  const T = (en: string, a: string) => (ar ? a : en);
  const initial = variants.find(offerAvailable) ?? variants[0];
  const [sel, setSel] = useState<(string | null)[]>(KEYS.map((k) => initial[k]));
  const [chosen, setChosen] = useState<string | null>(null);
  const [warranty, setWarranty] = useState(false);
  const [sticky, setSticky] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const buttonsRef = useRef<HTMLDivElement>(null);

  const isCondition = (o: O) => o.name.toLowerCase() === "condition";
  const ci = options.findIndex(isCondition);
  const matching = useMemo(() => variants.filter((x) => KEYS.every((k, i) => i >= options.length || x[k] === sel[i])), [variants, sel, options.length]);
  const ranked = useMemo(
    () => rankOffers(matching, { warrantyDefaultMonths: defaults.warrantyMonths, conditionOf: (o) => (ci >= 0 ? o[KEYS[ci]] : null) }),
    [matching, defaults.warrantyMonths, ci],
  );
  const v: BuyOffer | null = ranked.find((r) => r.offer.id === chosen)?.offer ?? ranked[0]?.offer ?? null;
  const available = !!v && offerAvailable(v);
  const condValue = ci >= 0 ? sel[ci] : null;

  useEffect(() => {
    const el = buttonsRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setSticky(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // tell the gallery which photos belong to the selected offer
  useEffect(() => {
    if (!v) return;
    const cond = effectiveCondition(v, condValue);
    window.dispatchEvent(new CustomEvent("tr-offer-photos", { detail: { photos: v.photos, stockImageWarning: !!cond.type && cond.type !== "NEW", variantImage: v.image } }));
  }, [v, condValue]);

  const valueState = (oi: number, value: string) => {
    const matches = variants.filter((x) => x[KEYS[oi]] === value && KEYS.every((k, i) => i === oi || i >= options.length || !sel[i] || x[k] === sel[i]));
    const any = variants.filter((x) => x[KEYS[oi]] === value);
    const pool = (matches.filter(offerAvailable).length ? matches.filter(offerAvailable) : matches.length ? matches : any);
    return { exists: any.length > 0, available: matches.some(offerAvailable), price: pool.length ? Math.min(...pool.map((x) => x.price)) : undefined };
  };
  const choose = (oi: number, value: string) => {
    const next = [...sel];
    next[oi] = value;
    if (!variants.some((x) => KEYS.every((k, i) => i >= options.length || x[k] === next[i]))) {
      const alt = variants.find((x) => x[KEYS[oi]] === value && offerAvailable(x)) ?? variants.find((x) => x[KEYS[oi]] === value);
      if (alt) KEYS.forEach((k, i) => (next[i] = alt[k]));
    }
    setSel(next);
    setChosen(null);
  };

  const price = v?.price ?? initial.price;
  const refNew = referenceNewPrice(v ?? initial, variants, priceNew, Math.max(0, ci));
  const off = pctOff(price, refNew);
  const wp = warrantyPrice(price, cfg);
  const showOptions = !(options.length === 1 && options[0].values.length === 1 && options[0].values[0] === "Default Title");
  const cond = v ? effectiveCondition(v, condValue) : { type: null, grade: null };
  const sellerName = (o: BuyOffer) => (o.seller ? o.seller.shopName : loc(locale, defaults.storeName, defaults.storeNameAr));

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
          {refNew > price && <p className="mt-1 text-sm font-semibold text-brand-700">{ar ? `وفّر ${aed(refNew - price, locale)}` : `You save ${aed(refNew - price, locale)}`}</p>}
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

        {/* ───── seller offers for the chosen configuration ───── */}
        {ranked.length > 1 && (
          <fieldset className="rounded-xl border border-slate-200 p-3">
            <legend className="px-1 text-sm font-bold">{T(`${ranked.length} offers from different sellers`, `${ranked.length} عروض من بائعين مختلفين`)}</legend>
            <div className="space-y-2">
              {ranked.map((r) => <OfferRow key={r.offer.id} r={r} lowest={Math.min(...ranked.filter((x) => offerAvailable(x.offer)).map((x) => x.offer.price))} checked={r.offer.id === v?.id}
                onPick={() => setChosen(r.offer.id)} defaults={defaults} condValue={condValue} sellerName={sellerName(r.offer)} />)}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <p>{T("“Recommended” weighs price, condition, warranty, seller rating, dispatch time and evidence — not price alone.", "«موصى به» يوازن بين السعر والحالة والضمان وتقييم البائع ووقت التجهيز والأدلة، وليس السعر فقط.")} <Link href="/grading#ranking" className="font-semibold text-brand-700 underline">{T("How offers are ranked", "كيف نرتب العروض")}</Link></p>
              <button type="button" onClick={() => setCompareOpen(true)} className="btn-outline px-3 py-1.5 text-xs">⇄ {T("Compare offers", "قارن العروض")}</button>
            </div>
          </fieldset>
        )}

        {v && available && v.trackInventory && !v.continueSelling && v.stock <= 3 && <p className="text-sm font-semibold text-amber-600">⚠ {fmt(t.common.onlyLeft, { n: v.stock })}</p>}

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

      {v && <ConditionPanel v={v} cond={cond} batteryRelevant={batteryRelevant} defaults={defaults} sellerName={sellerName(v)} />}

      {express && available && !v?.sellerId && <DeliveryCountdown />}
      <ul className="space-y-1.5 text-sm text-slate-600">
        {v?.sellerId
          ? <li>🚚 {T(`Dispatched by ${sellerName(v)} within ${v.handlingDays} business day${v.handlingDays === 1 ? "" : "s"}; delivery time shown at checkout.`, `يُجهّز البائع ${sellerName(v)} الطلب خلال ${v.handlingDays} يوم عمل، ويظهر موعد التوصيل عند الدفع.`)}</li>
          : <li>🚚 {express ? t.product.shipExpress : t.product.shipStandard}</li>}
        {codEnabled && <li>💵 {t.product.cod}</li>}
        {v?.sku && <li className="text-xs text-slate-400">{t.product.sku}: {v.sku}</li>}
      </ul>

      {compareOpen && <CompareModal ranked={ranked.filter((r) => offerAvailable(r.offer)).slice(0, 4)} onClose={() => setCompareOpen(false)} onPick={(id) => { setChosen(id); setCompareOpen(false); }}
        defaults={defaults} condValue={condValue} batteryRelevant={batteryRelevant} sellerName={sellerName} />}

      {/* Sticky add-to-cart bar */}
      <div className={`fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 shadow-2xl backdrop-blur transition-transform ${sticky ? "translate-y-0" : "translate-y-full"}`} aria-hidden={!sticky}>
        <div className="container-x flex items-center gap-3 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {onImage && <img src={onImage} alt="" className="hidden h-11 w-11 rounded-lg bg-slate-50 object-contain sm:block" />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="text-sm"><b>{aed(price, locale)}</b> {v && showOptions && <span className="text-slate-500">· {v.title.split(" / ").map((x) => t.values[x] ?? x).join(" / ")}</span>}{v?.seller && <span className="text-slate-500"> · {v.seller.shopName}</span>}</p>
          </div>
          {available ? <button form="buybox" className="btn-primary me-16" tabIndex={sticky ? 0 : -1}>{t.product.addToCart}</button> : <span className="me-16 text-sm text-slate-500">{t.common.soldOut}</span>}
        </div>
      </div>
    </div>
  );
}

// ───────────── offer row ─────────────

function OfferRow({ r, lowest, checked, onPick, defaults, condValue, sellerName }: {
  r: RankedOffer<BuyOffer>; lowest: number; checked: boolean; onPick: () => void; defaults: { warrantyMonths: number; returnDays: number }; condValue: string | null; sellerName: string;
}) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const o = r.offer;
  const sold = !offerAvailable(o);
  const cond = effectiveCondition(o, condValue);
  const w = warrantyFacts(o, defaults, cond.type);
  const level = evidenceLevel(o, o.verification !== "NONE");
  return (
    <label className={`block cursor-pointer rounded-xl border-2 p-3 transition ${checked ? "border-brand-600 bg-brand-50" : "border-slate-200 bg-white hover:border-slate-400"} ${sold ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        <input type="radio" name="offer" checked={checked} onChange={onPick} disabled={sold} className="mt-1 accent-brand-600" aria-label={sellerName} />
        <div className="min-w-0 flex-1 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            {o.seller ? <Link href={`/sellers/${o.seller.slug}`} className="font-bold text-brand-700 hover:underline" onClick={(e) => e.stopPropagation()}>{sellerName}</Link> : <b>{sellerName}</b>}
            <span className="text-xs text-slate-500">{o.seller ? (o.seller.ratingCount > 0 ? `★ ${o.seller.ratingAvg.toFixed(1)} (${o.seller.ratingCount})` : ar ? "بائع جديد" : "New seller") : ar ? "البائع المباشر" : "Direct"}</span>
            {r.recommended && <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-bold text-white">★ {ar ? "موصى به" : "Recommended"}</span>}
            {sold && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold">{ar ? "نفدت الكمية" : "Sold out"}</span>}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-600">
            {cond.type && <span className="font-semibold">{L(CONDITION_TYPE_LABEL[cond.type], locale)}{cond.grade ? ` · ${cond.grade}` : ""}</span>}
            {o.batteryHealth != null && <span>🔋 {o.batteryHealth}%</span>}
            <span>🛡️ {w.months ? (ar ? `${w.months} شهرًا` : `${w.months} mo`) : ar ? "بدون ضمان" : "No warranty"} · {L(WARRANTY_PROVIDER_LABEL[w.provider], locale)}</span>
            <span>↩️ {ar ? `${w.returnDays} يومًا` : `${w.returnDays}-day returns`}</span>
            <span>📦 {ar ? `تجهيز ${o.handlingDays} يوم` : `Ships in ${o.handlingDays} day${o.handlingDays === 1 ? "" : "s"}`}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <EvidencePill level={level === "none" ? "none" : level} compact />
            {r.recommended && r.reasons.length > 0 && <span className="text-xs text-brand-700">{ar ? "لأن: " : "Because: "}{r.reasons.map((x) => L(REASON_TEXT[x], locale)).join(" · ")}</span>}
          </div>
        </div>
        <div className="text-end">
          <p className="text-base font-black">{aed(o.price, locale)}</p>
          {o.price > lowest && !sold && <p className="text-xs text-slate-500">+{aed(o.price - lowest, locale)}</p>}
        </div>
      </div>
    </label>
  );
}

function warrantyFacts(o: BuyOffer, d: { warrantyMonths: number; returnDays: number }, type: string | null) {
  const provider = o.warrantyProvider ?? (o.sellerId ? "SELLER" : type === "NEW" ? "MANUFACTURER" : "KARAT");
  const explicit = o.warrantyMonths != null || o.warrantyProvider != null;
  return { provider, months: provider === "NONE" ? 0 : o.warrantyMonths ?? d.warrantyMonths, terms: o.warrantyTerms, returnDays: o.returnDays ?? d.returnDays, returnTerms: o.returnTerms, standard: !explicit && o.returnDays == null };
}

// ───────────── evidence ─────────────

const pillTone: Record<EvidenceLevel, string> = {
  verified: "bg-emerald-100 text-emerald-800", declared: "bg-slate-100 text-slate-700", store: "bg-slate-100 text-slate-700", none: "bg-amber-50 text-amber-700",
};
function EvidencePill({ level, compact }: { level: EvidenceLevel; compact?: boolean }) {
  const { locale } = useI18n();
  const short: Record<EvidenceLevel, [string, string]> = { verified: ["✓ Verified by TechRevive", "✓ مُتحقق منه"], declared: ["Seller-declared", "إقرار البائع"], store: ["Store-declared", "إقرار المتجر"], none: ["Not supplied", "غير متوفر"] };
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${pillTone[level]}`} title={L(EVIDENCE_LABEL[level], locale)}>{compact ? L(short[level], locale) : L(EVIDENCE_LABEL[level], locale)}</span>;
}

function ConditionPanel({ v, cond, batteryRelevant, defaults, sellerName }: {
  v: BuyOffer; cond: { type: string | null; grade: string | null }; batteryRelevant: boolean; defaults: { warrantyMonths: number; returnDays: number }; sellerName: string;
}) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const T = (en: string, a: string) => (ar ? a : en);
  const lvl = (present: boolean) => evidenceLevel(v, present);
  const w = warrantyFacts(v, defaults, cond.type);
  const tested = v.testedAt ? new Date(v.testedAt).toLocaleDateString(ar ? "ar-AE" : "en-AE", { dateStyle: "medium" }) : null;
  const rows: [string, string | null, boolean][] = [
    [T("Commercial condition", "الحالة التجارية"), cond.type ? L(CONDITION_TYPE_LABEL[cond.type], locale) : null, true],
    [T("Cosmetic grade", "الدرجة الشكلية"), cond.grade, true],
    [T("Functional status", "الحالة الوظيفية"), v.functionalStatus, true],
    ...(batteryRelevant || v.batteryHealth != null ? [[T("Battery health", "صحة البطارية"), v.batteryHealth != null ? `${v.batteryHealth}%${v.batteryCycles != null ? ` · ${v.batteryCycles} ${T("cycles", "دورة")}` : ""}` : null, true] as [string, string | null, boolean]] : []),
    [T("Repairs & replaced parts", "الإصلاحات والأجزاء المستبدلة"), v.repairDisclosure, true],
    [T("Included accessories", "الملحقات المرفقة"), v.accessories, true],
    [T("Testing", "الفحص"), tested || v.testedBy || v.testNotes ? [tested && T(`Tested ${tested}`, `فُحص في ${tested}`), v.testedBy && T(`by ${v.testedBy}`, `بواسطة ${v.testedBy}`), v.testNotes].filter(Boolean).join(" · ") : null, true],
  ];
  return (
    <details open className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
      <summary className="cursor-pointer font-bold">{T("Condition, evidence & terms of this offer", "حالة هذا العرض وأدلته وشروطه")}</summary>
      <p className="mt-1 text-xs text-slate-500">{T("Sold by", "يُباع بواسطة")} <b>{sellerName}</b>. {T("Each point shows who stands behind it.", "كل نقطة توضح الجهة المسؤولة عنها.")}</p>
      <dl className="mt-3 divide-y divide-slate-100">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2">
            <dt className="text-slate-500">{label}</dt>
            <dd className="flex max-w-[65%] flex-wrap items-center justify-end gap-2 text-end"><span className={value ? "font-medium" : "text-slate-400"}>{value ?? T("Not supplied", "غير متوفر")}</span><EvidencePill level={lvl(!!value)} /></dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
        {v.photos.length ? T(`📷 ${v.photos.length} photo(s) of this exact unit are in the gallery.`, `📷 ${v.photos.length} صور لهذه القطعة تحديدًا في المعرض.`) : cond.type && cond.type !== "NEW" ? T("📷 No photos of this exact unit were supplied. The gallery shows catalogue images, which may not show the unit you receive.", "📷 لم يتم تقديم صور لهذه القطعة تحديدًا. يعرض المعرض صور الكتالوج وقد لا تمثل القطعة التي ستستلمها.") : T("📷 The gallery shows catalogue images of this product.", "📷 يعرض المعرض صور الكتالوج لهذا المنتج.")}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="font-semibold">🛡️ {T("Warranty", "الضمان")}</p>
          <p className="mt-1">{w.months ? T(`${w.months} months`, `${w.months} شهرًا`) : T("No warranty", "بدون ضمان")} · {L(WARRANTY_PROVIDER_LABEL[w.provider], locale)}</p>
          {w.terms && <p className="mt-1 text-xs text-slate-600">{w.terms}</p>}
          <p className="mt-1 text-xs text-slate-500">{T("Service geography: UAE.", "نطاق الخدمة: الإمارات.")}{w.standard ? " " + T("Standard store terms apply.", "تسري شروط المتجر القياسية.") : ""}</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="font-semibold">↩️ {T("Returns", "الإرجاع")}</p>
          <p className="mt-1">{T(`${w.returnDays}-day returns`, `إرجاع خلال ${w.returnDays} يومًا`)}</p>
          {w.returnTerms && <p className="mt-1 text-xs text-slate-600">{w.returnTerms}</p>}
          <p className="mt-1 text-xs text-slate-500">{T("Your statutory rights are not affected.", "لا يؤثر ذلك على حقوقك القانونية.")}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">{T("Terms are saved with your order at checkout, so later changes by the seller never reduce them.", "تُحفظ هذه الشروط مع طلبك عند الدفع، فلا تُنتقص بتعديلات لاحقة من البائع.")} <Link href="/grading" className="font-semibold text-brand-700 underline">{T("Grading & evidence guide", "دليل التصنيف والأدلة")}</Link></p>
    </details>
  );
}

// ───────────── compare modal ─────────────

function CompareModal({ ranked, onClose, onPick, defaults, condValue, batteryRelevant, sellerName }: {
  ranked: RankedOffer<BuyOffer>[]; onClose: () => void; onPick: (id: string) => void; defaults: { warrantyMonths: number; returnDays: number }; condValue: string | null; batteryRelevant: boolean; sellerName: (o: BuyOffer) => string;
}) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const T = (en: string, a: string) => (ar ? a : en);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  const row = (label: string, f: (r: RankedOffer<BuyOffer>) => React.ReactNode) => (
    <tr className="border-b border-slate-100 align-top"><th className="w-32 bg-slate-50 p-2 text-start font-medium text-slate-500">{label}</th>{ranked.map((r) => <td key={r.offer.id} className="p-2">{f(r)}</td>)}</tr>
  );
  const NS = <span className="text-slate-400">{T("Not supplied", "غير متوفر")}</span>;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={T("Compare offers", "مقارنة العروض")} onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-black">{T("Compare offers", "مقارنة العروض")}</h2><button onClick={onClose} className="text-2xl" aria-label="Close">×</button></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <tbody>
              {row(T("Seller", "البائع"), (r) => <><b>{sellerName(r.offer)}</b>{r.recommended && <span className="ms-1 rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white">★</span>}<br /><span className="text-xs text-slate-500">{r.offer.seller ? (r.offer.seller.ratingCount ? `★ ${r.offer.seller.ratingAvg.toFixed(1)} (${r.offer.seller.ratingCount})` : T("New seller", "بائع جديد")) : T("Direct", "مباشر")}</span></>)}
              {row(T("Price", "السعر"), (r) => <b className="text-base">{aed(r.offer.price, locale)}</b>)}
              {row(T("Condition", "الحالة"), (r) => { const c = effectiveCondition(r.offer, condValue); return c.type ? `${L(CONDITION_TYPE_LABEL[c.type], locale)}${c.grade ? ` · ${c.grade}` : ""}` : NS; })}
              {row(T("Functional status", "الحالة الوظيفية"), (r) => r.offer.functionalStatus ?? NS)}
              {(batteryRelevant || ranked.some((r) => r.offer.batteryHealth != null)) && row(T("Battery", "البطارية"), (r) => (r.offer.batteryHealth != null ? `${r.offer.batteryHealth}%${r.offer.batteryCycles != null ? ` · ${r.offer.batteryCycles} ${T("cycles", "دورة")}` : ""}` : NS))}
              {row(T("Repairs", "الإصلاحات"), (r) => r.offer.repairDisclosure ?? NS)}
              {row(T("Accessories", "الملحقات"), (r) => r.offer.accessories ?? NS)}
              {row(T("Warranty", "الضمان"), (r) => { const w = warrantyFacts(r.offer, defaults, effectiveCondition(r.offer, condValue).type); return `${w.months ? T(`${w.months} months`, `${w.months} شهرًا`) : T("None", "بدون")} · ${L(WARRANTY_PROVIDER_LABEL[w.provider], locale)}`; })}
              {row(T("Returns", "الإرجاع"), (r) => T(`${warrantyFacts(r.offer, defaults, null).returnDays} days`, `${warrantyFacts(r.offer, defaults, null).returnDays} يومًا`))}
              {row(T("Dispatch", "التجهيز"), (r) => T(`${r.offer.handlingDays} business day(s)`, `${r.offer.handlingDays} يوم عمل`))}
              {row(T("Evidence", "الأدلة"), (r) => <EvidencePill level={evidenceLevel(r.offer, r.offer.verification !== "NONE")} />)}
              {row(T("Score", "النقاط"), (r) => <span title={Object.entries(r.parts).map(([k, x]) => `${k}: ${x.toFixed(1)}`).join(", ")}>{r.score} / 100</span>)}
              <tr><th className="bg-slate-50" />{ranked.map((r) => <td key={r.offer.id} className="p-2"><button onClick={() => onPick(r.offer.id)} className="btn-primary w-full py-2 text-xs">{T("Choose this offer", "اختر هذا العرض")}</button></td>)}</tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500">{T("Score = price 40 + condition 20 + warranty 15 + seller rating 10 + dispatch 10 + evidence 5. Sponsored placement is never mixed into this ranking.", "النقاط = السعر 40 + الحالة 20 + الضمان 15 + تقييم البائع 10 + التجهيز 10 + الأدلة 5. لا يُدمج أي ترويج مدفوع في هذا الترتيب.")}</p>
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

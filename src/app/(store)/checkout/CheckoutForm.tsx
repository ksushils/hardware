"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { Address } from "@prisma/client";
import { placeOrder, applyDiscountCode, checkGiftCard, recordCheckout } from "@/app/actions/checkout";
import { useFormAction } from "@/hooks/useFormAction";
import { aed, EMIRATES, EMIRATES_AR, loc } from "@/lib/format";
import { computeTotals, installment, lineTotal, type PricingConfig } from "@/lib/pricing";
import { buildShipments, etaText, type CarrierWindow, type SellerShipInfo } from "@/lib/shipmentMath";
import { useI18n, fmt } from "@/components/I18nProvider";

type Item = { id: string; productId: string; name: string; nameAr: string; variantTitle: string; image: string; price: number; quantity: number; warranty: boolean; express: boolean; sellerId: string | null; handlingDays: number };
type Rate = { id: string; name: string; nameAr: string; emirates: string; price: number; freeAbove: number | null; minOrder: number; maxOrder: number | null; expressOnly: boolean; deliveryDays: string };
type Applied = { id: string; title: string; code: string | null; type: string; amount: number; freeShipping: boolean };

export default function CheckoutForm({ user, addresses, items, stripe, cfg, checkoutCfg, rates, automatic, storeName, sellers, carrier }: {
  user: { email: string; name: string; phone: string } | null; addresses: Address[]; items: Item[]; stripe: boolean; cfg: PricingConfig;
  checkoutCfg: { cardEnabled: boolean; codEnabled: boolean; codMax: number; orderNotes: boolean; marketingOptIn: boolean; bnpl: boolean };
  rates: Rate[]; automatic: Applied | null; storeName: string; sellers: SellerShipInfo[]; carrier: CarrierWindow;
}) {
  const { t, locale } = useI18n();
  const { state, pending, formProps } = useFormAction(placeOrder);
  const [paymentMethod, setPayment] = useState(checkoutCfg.cardEnabled ? "CARD" : "COD");
  const [discount, setDiscount] = useState<Applied | null>(automatic);
  const [codeInput, setCodeInput] = useState("");
  const [codeMsg, setCodeMsg] = useState<string | null>(null);
  const [gift, setGift] = useState<{ code: string; balance: number } | null>(null);
  const [giftInput, setGiftInput] = useState("");
  const [giftMsg, setGiftMsg] = useState<string | null>(null);
  const [checking, startCheck] = useTransition();
  const [email, setEmail] = useState(user?.email ?? "");
  const [notes, setNotes] = useState("");
  const def = addresses[0];
  const [addr, setAddr] = useState({
    fullName: def?.fullName ?? user?.name ?? "", phone: def?.phone ?? user?.phone ?? "", emirate: def?.emirate ?? "Dubai",
    area: def?.area ?? "", street: def?.street ?? "", building: def?.building ?? "",
  });
  const lines = useMemo(() => items.map((i) => ({ price: i.price, quantity: i.quantity, warranty: i.warranty })), [items]);
  const sellerMap = useMemo(() => Object.fromEntries(sellers.map((x) => [x.id, x])), [sellers]);
  const shipItems = useMemo(() => items.map((i) => ({ sellerId: i.sellerId, price: i.price, quantity: i.quantity, warranty: i.warranty, handlingDays: i.handlingDays, express: i.express })), [items]);
  const pre = computeTotals(lines, { cfg, discount: discount?.amount });

  // The store ships its own items as one parcel and the buyer picks its delivery rate; each marketplace seller ships separately.
  const storeIdx = shipItems.map((x, i) => (x.sellerId ? -1 : i)).filter((i) => i >= 0);
  const hasStore = storeIdx.length > 0;
  const storeSub = storeIdx.reduce((sum, i) => sum + lineTotal(shipItems[i], cfg), 0);
  const share = pre.subtotal > 0 ? (pre.subtotal - pre.discount) / pre.subtotal : 1;
  const storeAfterDiscount = Math.round(storeSub * share * 100) / 100;
  const storeAllExpress = storeIdx.every((i) => shipItems[i].express);
  const available = hasStore
    ? rates.filter((r) => {
        const em = r.emirates.split(",").map((x) => x.trim()).filter(Boolean);
        return (!em.length || em.includes(addr.emirate)) && (!r.expressOnly || storeAllExpress) && storeAfterDiscount >= r.minOrder && (r.maxOrder == null || storeAfterDiscount <= r.maxOrder);
      })
    : [];
  const [rateId, setRateId] = useState<string>("");
  const rate = available.find((r) => r.id === rateId) ?? available[0] ?? null;
  const shipments = buildShipments(shipItems, sellerMap, { cfg, carrier, rate, discount: discount?.amount, freeShipping: discount?.freeShipping });
  const N = shipments.length;
  const totals = computeTotals(lines, { cfg, paymentMethod, discount: discount?.amount, freeShipping: discount?.freeShipping, giftCardBalance: gift?.balance, shipmentFees: shipments.map((x) => x.fee) });
  const codTooHigh = totals.total > checkoutCfg.codMax;

  useEffect(() => { if (user) recordCheckout(user.email); }, [user]);
  useEffect(() => { if (paymentMethod === "COD" && codTooHigh && checkoutCfg.cardEnabled) setPayment("CARD"); }, [codTooHigh, paymentMethod, checkoutCfg.cardEnabled]);

  const applyCode = () => startCheck(async () => {
    const r = await applyDiscountCode(codeInput, email);
    if (r.discount) { setDiscount(r.discount); setCodeMsg(fmt(t.checkout.applied, { code: r.discount.code ?? r.discount.title })); }
    else { setCodeMsg(r.error ?? null); }
  });
  const applyGift = () => startCheck(async () => {
    const r = await checkGiftCard(giftInput);
    if (r.code) { setGift({ code: r.code, balance: r.balance! }); setGiftMsg(`${fmt(t.checkout.applied, { code: r.code })} (${aed(r.balance!, locale)})`); }
    else { setGift(null); setGiftMsg(r.error ?? null); }
  });
  const set = (k: keyof typeof addr) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setAddr({ ...addr, [k]: e.target.value });
  const days = (d: string) => (d === "0" ? t.checkout.sameDay : d === "1" ? t.checkout.nextDay : fmt(t.checkout.days, { d }));

  return (
    <form {...formProps} className="mt-6 grid gap-6 lg:grid-cols-[1fr_400px]">
      <div className="space-y-6">
        <Section n={1} title={t.checkout.contact}>
          {user ? (
            <p className="text-sm">{t.checkout.signedInAs} <b>{user.email}</b><input type="hidden" name="email" value={user.email} /></p>
          ) : (
            <>
              <input name="email" type="email" required autoComplete="email" placeholder={t.common.email} className="input" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => email.includes("@") && recordCheckout(email)} />
              <p className="mt-2 text-xs text-slate-500">{t.checkout.haveAccount} <Link href="/login?next=/checkout" className="font-semibold text-brand-700 underline">{t.checkout.logIn}</Link> {t.checkout.fasterCheckout}</p>
            </>
          )}
          {checkoutCfg.marketingOptIn && <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" name="marketing" className="accent-brand-600" /> {t.checkout.marketing}</label>}
        </Section>

        <Section n={2} title={t.checkout.address}>
          {addresses.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {addresses.map((a) => (
                <button type="button" key={a.id} onClick={() => setAddr({ fullName: a.fullName, phone: a.phone, emirate: a.emirate, area: a.area, street: a.street, building: a.building })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-start text-xs hover:border-brand-600">
                  <b>{a.fullName}</b><br />{a.building}, {a.area}, {locale === "ar" ? EMIRATES_AR[a.emirate] : a.emirate}
                </button>
              ))}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <F label={t.checkout.fullName}><input name="fullName" required autoComplete="name" value={addr.fullName} onChange={set("fullName")} className="input" /></F>
            <F label={t.checkout.mobile}><input name="phone" required autoComplete="tel" dir="ltr" placeholder="05X XXX XXXX" value={addr.phone} onChange={set("phone")} className="input text-start" /></F>
            <F label={t.checkout.emirate}>
              <select name="emirate" value={addr.emirate} onChange={set("emirate")} className="input">{EMIRATES.map((e) => <option key={e} value={e}>{locale === "ar" ? EMIRATES_AR[e] : e}</option>)}</select>
            </F>
            <F label={t.checkout.area}><input name="area" required placeholder={t.checkout.areaPh} value={addr.area} onChange={set("area")} className="input" /></F>
            <F label={t.checkout.street}><input name="street" required autoComplete="address-line1" value={addr.street} onChange={set("street")} className="input" /></F>
            <F label={t.checkout.building}><input name="building" required autoComplete="address-line2" value={addr.building} onChange={set("building")} className="input" /></F>
          </div>
          {checkoutCfg.orderNotes && <div className="mt-3"><F label={t.checkout.notes}><input name="notes" placeholder={t.checkout.notesPh} value={notes} onChange={(e) => setNotes(e.target.value)} className="input" /></F></div>}
          {user && <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" name="saveAddress" defaultChecked className="accent-brand-600" /> {t.checkout.saveAddress}</label>}
        </Section>

        <Section n={3} title={t.checkout.deliveryMethod}>
          {hasStore && (
            <>
              {N > 1 && <p className="mb-2 text-sm font-semibold">{locale === "ar" ? `طريقة التوصيل من ${storeName}` : `Delivery method for items from ${storeName}`}</p>}
              {available.length === 0 ? <p className="text-sm text-red-600">{t.checkout.noRates}</p> : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {available.map((r) => {
                    const free = discount?.freeShipping || (r.freeAbove != null && storeAfterDiscount >= r.freeAbove);
                    return (
                      <Choice key={r.id} name="rateId" value={r.id} checked={rate?.id === r.id} onChange={setRateId}
                        title={`${loc(locale, r.name, r.nameAr)} · ${free ? t.cart.free : aed(r.price, locale)}`}
                        sub={`${days(r.deliveryDays)}${r.freeAbove != null && !free ? ` · ${fmt(t.checkout.freeAbove, { amount: aed(r.freeAbove, locale) })}` : ""}`} />
                    );
                  })}
                </div>
              )}
              {rate && <input type="hidden" name="rateId" value={rate.id} />}
            </>
          )}
          {/* Every shipment with its own fee and arrival window — never one date for parcels that ship separately */}
          <div className={hasStore ? "mt-4 space-y-2" : "space-y-2"} aria-label={locale === "ar" ? "الشحنات" : "Shipments"}>
            {(N > 1 || !hasStore) && <p className="text-sm font-semibold">{locale === "ar" ? `سيصلك طلبك في ${N} ${N === 1 ? "شحنة" : "شحنات"}` : `Your order arrives in ${N} ${N === 1 ? "shipment" : "shipments"}`}</p>}
            {shipments.map((sh, n) => (
              <div key={sh.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <div>
                  <p className="font-semibold">{locale === "ar" ? `شحنة ${n + 1} من ${N}` : `Shipment ${n + 1} of ${N}`} · {locale === "ar" ? "يُباع بواسطة" : "sold by"} {sh.kind === "SELLER" ? sh.sellerName : storeName}</p>
                  <p className="text-xs text-slate-600">{sh.itemIndexes.length} {locale === "ar" ? "منتج" : sh.itemIndexes.length === 1 ? "item" : "items"}{sh.etaMin != null ? ` · ${locale === "ar" ? "يصل خلال" : "arrives in"} ${etaText(sh.etaMin, sh.etaMax, locale)}` : ""}</p>
                </div>
                <p className="font-bold">{sh.fee > 0 ? aed(sh.fee, locale) : t.cart.free}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section n={4} title={t.checkout.payment}>
          <div className="grid gap-3">
            {checkoutCfg.cardEnabled && <Choice name="paymentMethod" value="CARD" checked={paymentMethod === "CARD"} onChange={setPayment} title={t.checkout.card} sub={stripe ? t.checkout.cardStripe : t.checkout.cardDemo} />}
            {checkoutCfg.codEnabled && <Choice name="paymentMethod" value="COD" checked={paymentMethod === "COD"} onChange={setPayment} disabled={codTooHigh}
              title={fmt(t.checkout.cod, { amount: aed(cfg.codFee, locale) })} sub={fmt(t.checkout.codSub, { amount: aed(checkoutCfg.codMax, locale) })} />}
          </div>
          {checkoutCfg.bnpl && <p className="mt-3 text-xs text-slate-500">{fmt(t.checkout.bnpl, { amount: aed(installment(totals.total), locale) })}</p>}
        </Section>
      </div>

      <aside className="card h-fit space-y-4 p-5 lg:sticky lg:top-36">
        <h2 className="text-lg font-bold">{t.checkout.yourOrder}</h2>
        <div className="space-y-4">
          {shipments.map((sh, n) => (
            <div key={sh.key}>
              {N > 1 && <p className="mb-2 text-xs font-semibold text-slate-500">{locale === "ar" ? `شحنة ${n + 1} من ${N} · ` : `Shipment ${n + 1} of ${N} · `}{sh.kind === "SELLER" ? sh.sellerName : storeName}</p>}
              <ul className="space-y-3">
                {sh.itemIndexes.map((idx) => {
                  const i = items[idx];
                  return (
                    <li key={i.id} className="flex gap-3">
                      <div className="relative h-14 w-14 shrink-0 rounded-lg bg-slate-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={i.image} alt="" className="h-full w-full object-contain p-1" />
                        <span className="absolute -end-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-slate-700 text-[11px] font-bold text-white">{i.quantity}</span>
                      </div>
                      <div className="flex-1 text-sm">
                        <p className="line-clamp-2 font-medium">{loc(locale, i.name, i.nameAr)}</p>
                        <p className="text-xs text-slate-500">{i.variantTitle.split(" / ").map((x) => t.values[x] ?? x).join(" / ")}{i.warranty ? " · Care+" : ""}</p>
                        {N === 1 && <p className="text-xs text-slate-500">{locale === "ar" ? "يُباع بواسطة" : "Sold by"} {sh.kind === "SELLER" ? sh.sellerName : storeName}</p>}
                      </div>
                      <p className="text-sm font-semibold">{aed(i.price * i.quantity, locale)}</p>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={codeInput} onChange={(e) => setCodeInput(e.target.value.toUpperCase())} placeholder={t.checkout.discountCode} aria-label={t.checkout.discountCode} className="input py-2" />
          <button type="button" onClick={applyCode} disabled={!codeInput || checking} className="btn-outline py-2">{t.common.apply}</button>
        </div>
        {discount?.code && <input type="hidden" name="discountCode" value={discount.code} />}
        {codeMsg && <p className={`text-xs ${discount?.code ? "text-brand-700" : "text-red-600"}`}>{codeMsg}</p>}
        <details className="text-sm">
          <summary className="cursor-pointer text-slate-600">🎁 {t.checkout.giftCard}</summary>
          <div className="mt-2 flex gap-2">
            <input value={giftInput} onChange={(e) => setGiftInput(e.target.value.toUpperCase())} placeholder={t.checkout.giftCardCode} aria-label={t.checkout.giftCardCode} className="input py-2" />
            <button type="button" onClick={applyGift} disabled={!giftInput || checking} className="btn-outline py-2">{t.common.apply}</button>
          </div>
          {giftMsg && <p className={`mt-1 text-xs ${gift ? "text-brand-700" : "text-red-600"}`}>{giftMsg}</p>}
        </details>
        {gift && <input type="hidden" name="giftCardCode" value={gift.code} />}
        <div className="space-y-2 border-t pt-3 text-sm">
          <Row l={t.cart.subtotal} r={aed(totals.subtotal, locale)} />
          {totals.discount > 0 && <Row l={`${t.checkout.discount} (${discount?.code ?? discount?.title ?? t.checkout.automatic})`} r={`− ${aed(totals.discount, locale)}`} />}
          {N > 1
            ? shipments.map((sh, n) => <Row key={sh.key} l={`${t.checkout.shipping} · ${locale === "ar" ? `شحنة ${n + 1}` : `shipment ${n + 1}`}`} r={sh.fee > 0 && !discount?.freeShipping ? aed(sh.fee, locale) : t.cart.free} />)
            : <Row l={t.checkout.shipping} r={totals.shipping ? aed(totals.shipping, locale) : t.cart.free} />}
          {totals.codFee > 0 && <Row l={t.checkout.codFee} r={aed(totals.codFee, locale)} />}
          {totals.giftCard > 0 && <Row l={t.checkout.giftCardUsed} r={`− ${aed(totals.giftCard, locale)}`} />}
          <div className="flex justify-between border-t pt-2 text-base font-bold"><span>{t.checkout.total}</span><span>{aed(totals.total, locale)}</span></div>
          <p className="text-xs text-slate-500">{fmt(t.checkout.includesVat, { amount: aed(totals.vat, locale) })}</p>
        </div>
        {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{state.error}</p>}
        <button className="btn-primary w-full" disabled={pending || (hasStore && !rate)}>
          {pending ? t.checkout.placing : paymentMethod === "CARD" && totals.total > 0 ? fmt(t.checkout.pay, { amount: aed(totals.total, locale) }) : t.checkout.placeOrder}
        </button>
        <p className="text-center text-xs text-slate-500">{t.checkout.agree} <Link href="/pages/terms" className="underline">{t.checkout.terms}</Link>.</p>
      </aside>
    </form>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="mb-4 flex items-center gap-3 text-lg font-bold"><span className="grid h-7 w-7 place-items-center rounded-full bg-ink-900 text-sm text-white">{n}</span>{title}</h2>
      {children}
    </section>
  );
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="label">{label}</span>{children}</label>;
}
function Row({ l, r }: { l: string; r: string }) {
  return <div className="flex justify-between gap-2"><span className="text-slate-600">{l}</span><span className="whitespace-nowrap">{r}</span></div>;
}
function Choice({ name, value, checked, onChange, title, sub, disabled }: { name: string; value: string; checked: boolean; onChange: (v: string) => void; title: string; sub: string; disabled?: boolean }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 ${checked ? "border-brand-600 bg-brand-50" : "border-slate-200"} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}>
      <input type="radio" name={name} value={value} checked={checked} disabled={disabled} onChange={() => onChange(value)} className="mt-1 accent-brand-600" />
      <span><span className="block text-sm font-semibold">{title}</span><span className="text-xs text-slate-500">{sub}</span></span>
    </label>
  );
}

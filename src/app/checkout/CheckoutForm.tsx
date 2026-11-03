"use client";
import { useFormAction } from "@/hooks/useFormAction";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Address } from "@prisma/client";
import { placeOrder, checkCoupon } from "@/app/actions/checkout";
import { aed, conditionLabel, EMIRATES } from "@/lib/format";
import { computeTotals, COD_FEE, EXPRESS_FEE, installment, type Coupon } from "@/lib/pricing";

type Item = { id: string; name: string; condition: string; image: string; price: number; quantity: number; warranty: boolean; express: boolean };

export default function CheckoutForm({ user, addresses, items, stripe }: {
  user: { email: string; name: string; phone: string } | null; addresses: Address[]; items: Item[]; stripe: boolean;
}) {
  const { state, pending, formProps } = useFormAction(placeOrder);
  const [shippingMethod, setShipping] = useState("STANDARD");
  const [paymentMethod, setPayment] = useState("CARD");
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [checking, startCheck] = useTransition();
  const def = addresses[0];
  const [addr, setAddr] = useState({
    fullName: def?.fullName ?? user?.name ?? "", phone: def?.phone ?? user?.phone ?? "", emirate: def?.emirate ?? "Dubai",
    area: def?.area ?? "", street: def?.street ?? "", building: def?.building ?? "",
  });
  const allExpress = items.every((i) => i.express);
  const lines = items.map((i) => ({ price: i.price, quantity: i.quantity, warranty: i.warranty }));
  const totals = useMemo(() => computeTotals(lines, { shippingMethod, paymentMethod, coupon }), [lines, shippingMethod, paymentMethod, coupon]);

  const applyCoupon = () =>
    startCheck(async () => {
      const res = await checkCoupon(couponInput, totals.subtotal);
      if ("error" in res) { setCoupon(null); setCouponMsg(res.error ?? null); }
      else { setCoupon(res.coupon); setCouponMsg(`Coupon ${res.coupon.code} applied!`); }
    });

  const set = (k: keyof typeof addr) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setAddr({ ...addr, [k]: e.target.value });

  return (
    <form {...formProps} className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <Section n={1} title="Contact">
          {user ? (
            <p className="text-sm">Signed in as <b>{user.email}</b><input type="hidden" name="email" value={user.email} /></p>
          ) : (
            <>
              <input name="email" type="email" required placeholder="Email address" className="input" />
              <p className="mt-2 text-xs text-slate-500">Have an account? <Link href="/login?next=/checkout" className="font-semibold text-brand-700 underline">Log in</Link> for faster checkout.</p>
            </>
          )}
        </Section>

        <Section n={2} title="Delivery address">
          {addresses.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {addresses.map((a) => (
                <button type="button" key={a.id} onClick={() => setAddr({ fullName: a.fullName, phone: a.phone, emirate: a.emirate, area: a.area, street: a.street, building: a.building })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-left text-xs hover:border-brand-600">
                  <b>{a.fullName}</b><br />{a.building}, {a.area}, {a.emirate}
                </button>
              ))}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="Full name"><input name="fullName" required value={addr.fullName} onChange={set("fullName")} className="input" /></F>
            <F label="Mobile (UAE)"><input name="phone" required placeholder="05X XXX XXXX" value={addr.phone} onChange={set("phone")} className="input" /></F>
            <F label="Emirate">
              <select name="emirate" value={addr.emirate} onChange={set("emirate")} className="input">{EMIRATES.map((e) => <option key={e}>{e}</option>)}</select>
            </F>
            <F label="Area / Community"><input name="area" required placeholder="e.g. Dubai Marina" value={addr.area} onChange={set("area")} className="input" /></F>
            <F label="Street"><input name="street" required value={addr.street} onChange={set("street")} className="input" /></F>
            <F label="Building / Villa & Apt no."><input name="building" required value={addr.building} onChange={set("building")} className="input" /></F>
          </div>
          <F label="Delivery notes (optional)"><input name="notes" placeholder="Landmark, preferred time..." className="input mt-1" /></F>
          {user && <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" name="saveAddress" defaultChecked className="accent-brand-600" /> Save this address to my account</label>}
        </Section>

        <Section n={3} title="Delivery method">
          <div className="grid gap-3 sm:grid-cols-2">
            <Choice name="shippingMethod" value="STANDARD" checked={shippingMethod === "STANDARD"} onChange={setShipping} title="Standard (2–4 days)" sub="Free over AED 200" />
            <Choice name="shippingMethod" value="EXPRESS" checked={shippingMethod === "EXPRESS"} onChange={setShipping} disabled={!allExpress}
              title={`Express next-day (+${aed(EXPRESS_FEE)})`} sub={allExpress ? "Order by 3 PM" : "Not every item in your cart is eligible"} />
          </div>
        </Section>

        <Section n={4} title="Payment">
          <div className="grid gap-3">
            <Choice name="paymentMethod" value="CARD" checked={paymentMethod === "CARD"} onChange={setPayment}
              title="Credit / Debit card, Apple Pay, Google Pay" sub={stripe ? "Secure checkout powered by Stripe" : "Secure card payment (demo gateway)"} />
            <Choice name="paymentMethod" value="COD" checked={paymentMethod === "COD"} onChange={setPayment}
              title={`Cash / card on delivery (+${aed(COD_FEE)})`} sub="Available for orders up to AED 5,000" />
          </div>
          <p className="mt-3 text-xs text-slate-500">Prefer to split it? Pay 4 × {aed(installment(totals.total))} with a BNPL provider (configure Tabby or Tamara in production).</p>
        </Section>
      </div>

      <aside className="card h-fit space-y-4 p-5 lg:sticky lg:top-36">
        <h2 className="text-lg font-bold">Your order</h2>
        <ul className="space-y-3">
          {items.map((i) => (
            <li key={i.id} className="flex gap-3">
              <div className="relative h-14 w-14 shrink-0 rounded-lg bg-slate-50">
                <Image src={i.image} alt="" fill className="object-contain p-1" unoptimized />
                <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-slate-700 text-[11px] font-bold text-white">{i.quantity}</span>
              </div>
              <div className="flex-1 text-sm">
                <p className="line-clamp-2 font-medium">{i.name}</p>
                <p className="text-xs text-slate-500">{conditionLabel(i.condition)}{i.warranty ? " · Care+" : ""}</p>
              </div>
              <p className="text-sm font-semibold">{aed(i.price * i.quantity)}</p>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} placeholder="Coupon code" className="input py-2" />
          <button type="button" onClick={applyCoupon} disabled={!couponInput || checking} className="btn-outline py-2">{checking ? "..." : "Apply"}</button>
        </div>
        {coupon && <input type="hidden" name="couponCode" value={coupon.code} />}
        {couponMsg && <p className={`text-xs ${coupon ? "text-brand-700" : "text-red-600"}`}>{couponMsg}</p>}
        <div className="space-y-2 border-t pt-3 text-sm">
          <Row l="Subtotal" r={aed(totals.subtotal)} />
          {totals.discount > 0 && <Row l={`Discount (${coupon?.code})`} r={`− ${aed(totals.discount)}`} />}
          <Row l="Delivery" r={totals.shipping - totals.codFee ? aed(totals.shipping - totals.codFee) : "FREE"} />
          {totals.codFee > 0 && <Row l="COD fee" r={aed(totals.codFee)} />}
          <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span>{aed(totals.total)}</span></div>
          <p className="text-xs text-slate-500">Includes 5% VAT: {aed(totals.vat)}</p>
        </div>
        {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        <button className="btn-primary w-full" disabled={pending}>
          {pending ? "Placing order..." : paymentMethod === "CARD" ? `Pay ${aed(totals.total)}` : "Place order"}
        </button>
        <p className="text-center text-xs text-slate-500">By placing your order you agree to our <Link href="/terms" className="underline">Terms</Link>.</p>
      </aside>
    </form>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="mb-4 flex items-center gap-3 text-lg font-bold">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-ink-900 text-sm text-white">{n}</span>{title}
      </h2>
      {children}
    </section>
  );
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="label">{label}</span>{children}</label>;
}
function Row({ l, r }: { l: string; r: string }) {
  return <div className="flex justify-between"><span className="text-slate-600">{l}</span><span>{r}</span></div>;
}
function Choice({ name, value, checked, onChange, title, sub, disabled }: {
  name: string; value: string; checked: boolean; onChange: (v: string) => void; title: string; sub: string; disabled?: boolean;
}) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 ${checked ? "border-brand-600 bg-brand-50" : "border-slate-200"} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}>
      <input type="radio" name={name} value={value} checked={checked} disabled={disabled} onChange={() => onChange(value)} className="mt-1 accent-brand-600" />
      <span><span className="block text-sm font-semibold">{title}</span><span className="text-xs text-slate-500">{sub}</span></span>
    </label>
  );
}

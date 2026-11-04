"use client";
import { useFormAction } from "@/hooks/useFormAction";
import { updateShopSettings } from "@/app/actions/seller";

type S = { shopName: string; email: string; phone: string; address: string; about: string; aboutAr: string; returnPolicy: string; shippingPolicy: string; bankName: string; accountName: string; iban: string; flatShippingFee: number; freeShippingOver: number | null; vacationMode: boolean; vacationMessage: string; vacationUntil: string; logoUrl: string | null; bannerUrl: string | null; social: Record<string, string> };

export default function ShopSettingsForm({ s }: { s: S }) {
  const { state, pending, formProps } = useFormAction(updateShopSettings);
  const box = "rounded-xl border border-slate-200 bg-white p-4 shadow-sm";
  return (
    <form {...formProps} className="space-y-5">
      <section className={box}>
        <h2 className="mb-3 text-sm font-semibold">Shop profile</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label><span className="label">Shop name</span><input name="shopName" defaultValue={s.shopName} className="in-a" /></label>
          <label><span className="label">Contact email</span><input name="email" defaultValue={s.email} className="in-a" /></label>
          <label><span className="label">Phone</span><input name="phone" defaultValue={s.phone} className="in-a" /></label>
          <label><span className="label">Address</span><input name="address" defaultValue={s.address} className="in-a" /></label>
          <label><span className="label">About (English)</span><textarea name="about" rows={4} defaultValue={s.about} className="in-a" /></label>
          <label><span className="label">About (Arabic)</span><textarea name="aboutAr" rows={4} defaultValue={s.aboutAr} dir="rtl" className="in-a" /></label>
          <div>
            <span className="label">Logo</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {s.logoUrl && <img src={s.logoUrl} alt="" className="mb-2 h-16 w-16 rounded-lg border object-contain" />}
            <input type="file" name="logo" accept="image/*" className="text-sm" />
          </div>
          <div>
            <span className="label">Banner (wide image)</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {s.bannerUrl && <img src={s.bannerUrl} alt="" className="mb-2 h-16 w-full rounded-lg border object-cover" />}
            <input type="file" name="banner" accept="image/*" className="text-sm" />
          </div>
          {["instagram", "facebook", "x", "tiktok", "website"].map((k) => <label key={k}><span className="label capitalize">{k} URL</span><input name={`social_${k}`} defaultValue={s.social[k] ?? ""} placeholder="https://" className="in-a" /></label>)}
        </div>
      </section>
      <section className={box}>
        <h2 className="mb-3 text-sm font-semibold">Policies & shipping</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label><span className="label">Return policy</span><textarea name="returnPolicy" rows={4} defaultValue={s.returnPolicy} placeholder="Must be at least as generous as the marketplace's 14-day policy" className="in-a" /></label>
          <label><span className="label">Shipping policy</span><textarea name="shippingPolicy" rows={4} defaultValue={s.shippingPolicy} placeholder="Dispatch time, couriers, coverage" className="in-a" /></label>
          <label><span className="label">Flat shipping fee you charge the marketplace (AED, informational)</span><input name="flatShippingFee" type="number" step="0.01" defaultValue={s.flatShippingFee} className="in-a" /></label>
          <label><span className="label">Free shipping over (AED)</span><input name="freeShippingOver" type="number" step="0.01" defaultValue={s.freeShippingOver ?? ""} className="in-a" /></label>
        </div>
      </section>
      <section className={box}>
        <h2 className="mb-3 text-sm font-semibold">Payout bank account</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <label><span className="label">Bank</span><input name="bankName" defaultValue={s.bankName} className="in-a" /></label>
          <label><span className="label">Account name</span><input name="accountName" defaultValue={s.accountName} className="in-a" /></label>
          <label><span className="label">IBAN</span><input name="iban" defaultValue={s.iban} placeholder="AE07 0331 2345 6789 0123 456" className="in-a font-mono" /></label>
        </div>
      </section>
      <section className={box}>
        <h2 className="mb-3 text-sm font-semibold">Vacation mode</h2>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="vacationMode" defaultChecked={s.vacationMode} /> Pause my shop — products stay visible but can&apos;t be bought</label>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label><span className="label">Message shown to customers</span><input name="vacationMessage" defaultValue={s.vacationMessage} placeholder="Back on 20 Nov — orders resume then" className="in-a" /></label>
          <label><span className="label">Automatically end on</span><input name="vacationUntil" type="date" defaultValue={s.vacationUntil} className="in-a" /></label>
        </div>
      </section>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.ok}</p>}
      <button className="btn-a-primary" disabled={pending}>{pending ? "Saving…" : "Save settings"}</button>
    </form>
  );
}

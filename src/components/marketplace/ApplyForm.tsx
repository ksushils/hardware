"use client";
import { useEffect, useState } from "react";
import { useFormAction } from "@/hooks/useFormAction";
import { applyAsSeller, checkShopSlug } from "@/app/actions/marketplace";
import { useI18n } from "@/components/I18nProvider";
import { EMIRATES, EMIRATES_AR } from "@/lib/format";

export default function ApplyForm({ email, phone, terms }: { email: string; phone: string; terms: string }) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const { state, pending, formProps } = useFormAction(applyAsSeller);
  const [shopName, setShopName] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  const [check, setCheck] = useState<{ slug: string; available: boolean } | null>(null);
  useEffect(() => { if (!touched) setSlug(shopName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")); }, [shopName, touched]);
  useEffect(() => {
    if (slug.length < 3) { setCheck(null); return; }
    const id = setTimeout(() => checkShopSlug(slug).then(setCheck), 300);
    return () => clearTimeout(id);
  }, [slug]);
  const L = (en: string, a: string) => (ar ? a : en);
  return (
    <form {...formProps} className="space-y-6">
      <section className="card space-y-4 p-6">
        <h2 className="text-lg font-bold">1. {L("Your shop", "متجرك")}</h2>
        <label className="block"><span className="label">{L("Shop name", "اسم المتجر")}</span><input name="shopName" value={shopName} onChange={(e) => setShopName(e.target.value)} required className="input" /></label>
        <label className="block">
          <span className="label">{L("Shop URL", "رابط المتجر")}</span>
          <div className="flex items-center gap-1" dir="ltr"><span className="text-sm text-slate-500">/sellers/</span><input name="slug" value={slug} onChange={(e) => { setTouched(true); setSlug(e.target.value.toLowerCase()); }} required className="input" /></div>
          {check && <span className={`mt-1 block text-xs font-semibold ${check.available ? "text-brand-700" : "text-red-600"}`}>{check.available ? `✓ /sellers/${check.slug} ${L("is available", "متاح")}` : `✕ ${L("Not available", "غير متاح")}`}</span>}
        </label>
        <label className="block"><span className="label">{L("About your shop", "نبذة عن متجرك")} ({L("optional", "اختياري")})</span><textarea name="about" rows={3} className="input" placeholder={L("What do you sell? How long have you been in business?", "ماذا تبيع؟ ومنذ متى تعمل؟")} /></label>
      </section>
      <section className="card space-y-4 p-6">
        <h2 className="text-lg font-bold">2. {L("Business & contact", "النشاط التجاري والتواصل")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className="label">{L("Business email", "البريد التجاري")}</span><input name="email" type="email" defaultValue={email} required className="input" /></label>
          <label><span className="label">{L("Phone", "الهاتف")}</span><input name="phone" defaultValue={phone} required placeholder="05X XXX XXXX" className="input" /></label>
          <label><span className="label">{L("Emirate", "الإمارة")}</span><select name="emirate" className="input">{EMIRATES.map((e) => <option key={e} value={e}>{ar ? EMIRATES_AR[e] : e}</option>)}</select></label>
          <label><span className="label">{L("Business address", "عنوان النشاط")}</span><input name="address" required className="input" /></label>
          <label><span className="label">{L("Trade licence number", "رقم الرخصة التجارية")}</span><input name="tradeLicenseNo" required className="input" /></label>
          <label><span className="label">{L("Licence expiry date", "تاريخ انتهاء الرخصة")}</span><input name="tradeLicenseExpiry" type="date" required className="input" /></label>
          <label><span className="label">{L("VAT TRN (15 digits, if registered)", "رقم التسجيل الضريبي (إن وجد)")}</span><input name="trn" inputMode="numeric" maxLength={15} className="input" /></label>
          <label><span className="label">{L("Trade licence copy (PDF or image)", "نسخة الرخصة التجارية (PDF أو صورة)")}</span><input name="tradeLicense" type="file" accept="application/pdf,image/*" className="input py-2" /></label>
        </div>
      </section>
      <section className="card space-y-4 p-6">
        <h2 className="text-lg font-bold">3. {L("Payout bank account", "الحساب البنكي للتحويلات")}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <label><span className="label">{L("Bank", "البنك")}</span><input name="bankName" className="input" /></label>
          <label><span className="label">{L("Account name", "اسم الحساب")}</span><input name="accountName" className="input" /></label>
          <label><span className="label">IBAN</span><input name="iban" placeholder="AE.." className="input font-mono" dir="ltr" /></label>
        </div>
        <p className="text-xs text-slate-500">{L("You can add this later in your seller portal.", "يمكنك إضافته لاحقًا من لوحة البائع.")}</p>
      </section>
      <section className="card p-6">
        <p className="text-sm text-slate-600">{terms}</p>
        <label className="mt-3 flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="terms" required className="h-4 w-4 accent-brand-600" /> {L("I agree to the seller terms and commission", "أوافق على شروط البائع والعمولة")}</label>
        {state?.error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        <button className="btn-primary mt-4 w-full" disabled={pending || (check !== null && !check.available)}>{pending ? L("Submitting…", "جارٍ الإرسال…") : L("Submit application", "إرسال الطلب")}</button>
      </section>
    </form>
  );
}

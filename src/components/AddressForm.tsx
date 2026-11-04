"use client";
import { useFormAction } from "@/hooks/useFormAction";
import { saveAddress } from "@/app/actions/account";
import { EMIRATES, EMIRATES_AR } from "@/lib/format";
import { useI18n } from "./I18nProvider";

export default function AddressForm() {
  const { t, locale } = useI18n();
  const { state, pending, formProps } = useFormAction(saveAddress, true);
  return (
    <form {...formProps} className="card space-y-3 p-6">
      <h2 className="text-lg font-bold">{t.account.addAddress}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="fullName" placeholder={t.checkout.fullName} required className="input" aria-label={t.checkout.fullName} />
        <input name="phone" placeholder={t.checkout.mobile} required dir="ltr" className="input text-start" aria-label={t.checkout.mobile} />
        <select name="emirate" className="input" aria-label={t.checkout.emirate}>{EMIRATES.map((e) => <option key={e} value={e}>{locale === "ar" ? EMIRATES_AR[e] : e}</option>)}</select>
        <input name="area" placeholder={t.checkout.area} required className="input" aria-label={t.checkout.area} />
        <input name="street" placeholder={t.checkout.street} required className="input" aria-label={t.checkout.street} />
        <input name="building" placeholder={t.checkout.building} required className="input" aria-label={t.checkout.building} />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-brand-700">{state.ok}</p>}
      <button className="btn-primary" disabled={pending}>{t.account.saveAddress}</button>
    </form>
  );
}

"use client";
import { useFormAction } from "@/hooks/useFormAction";
import { updateProfile } from "@/app/actions/account";
import { useI18n } from "./I18nProvider";

export default function ProfileForm({ name, email, phone, locale: userLocale, marketing }: { name: string; email: string; phone: string; locale: string; marketing: boolean }) {
  const { t } = useI18n();
  const { state, pending, formProps } = useFormAction(updateProfile);
  return (
    <form {...formProps} className="card space-y-4 p-6">
      <h2 className="text-lg font-bold">{t.account.profile}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className="label">{t.auth.fullName}</span><input name="name" defaultValue={name} className="input" /></label>
        <label><span className="label">{t.account.email}</span><input value={email} disabled className="input bg-slate-100" /></label>
        <label><span className="label">{t.account.mobile}</span><input name="phone" dir="ltr" defaultValue={phone} className="input text-start" /></label>
        <label><span className="label">{t.account.language}</span><select name="locale" defaultValue={userLocale} className="input"><option value="en">English</option><option value="ar">العربية</option></select></label>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="marketing" defaultChecked={marketing} className="accent-brand-600" /> {t.auth.marketing}</label>
      <h3 className="pt-2 font-semibold">{t.account.changePassword}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className="label">{t.account.currentPassword}</span><input name="currentPassword" type="password" className="input" autoComplete="current-password" /></label>
        <label><span className="label">{t.account.newPassword}</span><input name="newPassword" type="password" className="input" autoComplete="new-password" /></label>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-brand-700">{state.ok}</p>}
      <button className="btn-primary" disabled={pending}>{pending ? t.account.saving : t.account.saveChanges}</button>
    </form>
  );
}

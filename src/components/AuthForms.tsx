"use client";
import Link from "next/link";
import { useFormAction } from "@/hooks/useFormAction";
import { forgotPassword, login, register, resetPassword } from "@/app/actions/auth";
import { useI18n } from "./I18nProvider";

const q = (next?: string) => (next ? `?next=${encodeURIComponent(next)}` : "");

export function LoginForm({ next }: { next?: string }) {
  const { t } = useI18n();
  const { state, pending, formProps } = useFormAction(login);
  return (
    <form {...formProps} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <label className="block"><span className="label">{t.common.email}</span><input name="email" type="email" required className="input" autoComplete="email" /></label>
      <label className="block">
        <span className="label flex justify-between">{t.auth.password}<Link href="/forgot-password" className="font-normal text-brand-700 hover:underline">{t.auth.forgot}</Link></span>
        <input name="password" type="password" required className="input" autoComplete="current-password" />
      </label>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? t.auth.signingIn : t.auth.signIn}</button>
      <p className="text-center text-sm">{t.auth.newHere} <Link href={`/register${q(next)}`} className="font-semibold text-brand-700 underline">{t.auth.createAccount}</Link></p>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const { t } = useI18n();
  const { state, pending, formProps } = useFormAction(register);
  return (
    <form {...formProps} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <label className="block"><span className="label">{t.auth.fullName}</span><input name="name" required className="input" autoComplete="name" /></label>
      <label className="block"><span className="label">{t.common.email}</span><input name="email" type="email" required className="input" autoComplete="email" /></label>
      <label className="block"><span className="label">{t.auth.mobileOpt}</span><input name="phone" dir="ltr" placeholder="05X XXX XXXX" className="input text-start" autoComplete="tel" /></label>
      <label className="block"><span className="label">{t.auth.password}</span><input name="password" type="password" minLength={8} required className="input" autoComplete="new-password" /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="marketing" className="accent-brand-600" /> {t.auth.marketing}</label>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? t.auth.creating : t.auth.createAccount}</button>
      <p className="text-center text-sm">{t.auth.haveAccount} <Link href={`/login${q(next)}`} className="font-semibold text-brand-700 underline">{t.auth.signIn}</Link></p>
    </form>
  );
}

export function ForgotForm() {
  const { t } = useI18n();
  const { state, pending, formProps } = useFormAction(forgotPassword);
  if (state?.ok) return <p className="rounded-lg bg-brand-50 p-4 text-sm text-brand-700">✓ {state.ok}</p>;
  return (
    <form {...formProps} className="space-y-4">
      <label className="block"><span className="label">{t.common.email}</span><input name="email" type="email" required className="input" autoComplete="email" /></label>
      <button className="btn-primary w-full" disabled={pending}>{t.auth.sendLink}</button>
      <p className="text-center text-sm"><Link href="/login" className="font-semibold text-brand-700 underline">{t.auth.signIn}</Link></p>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const { t } = useI18n();
  const { state, pending, formProps } = useFormAction(resetPassword);
  return (
    <form {...formProps} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <label className="block"><span className="label">{t.auth.newPassword}</span><input name="password" type="password" minLength={8} required className="input" autoComplete="new-password" /></label>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{t.auth.resetSubmit}</button>
    </form>
  );
}

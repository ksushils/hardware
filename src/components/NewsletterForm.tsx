"use client";
import { useFormAction } from "@/hooks/useFormAction";
import { subscribeNewsletter } from "@/app/actions/account";
import { useI18n } from "./I18nProvider";

export default function NewsletterForm() {
  const { t } = useI18n();
  const { state, pending, formProps } = useFormAction(subscribeNewsletter, true);
  return (
    <form {...formProps} className="flex w-full max-w-md flex-col gap-2">
      <div className="flex gap-2">
        <input name="email" type="email" required placeholder={t.footer.emailPh} aria-label={t.footer.emailPh} className="input border-white/20 bg-white/10 text-white placeholder:text-slate-400" />
        <button className="btn-primary shrink-0" disabled={pending}>{t.footer.subscribe}</button>
      </div>
      {state?.ok && <p className="text-sm text-brand-500">{t.footer.subscribed}</p>}
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
    </form>
  );
}

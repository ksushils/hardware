"use client";
import { useFormAction } from "@/hooks/useFormAction";
import { requestReturn } from "@/app/actions/account";
import { useI18n } from "./I18nProvider";

export default function ReturnForm({ number, items, k }: { number: string; items: { id: string; name: string; quantity: number }[]; k?: string }) {
  const { t } = useI18n();
  const { state, pending, formProps } = useFormAction(requestReturn);
  if (state?.ok) return <p className="card p-5 text-sm font-semibold text-brand-700">✓ {state.ok}</p>;
  return (
    <details className="card p-5">
      <summary className="cursor-pointer font-semibold">↩️ {t.order.requestReturn}</summary>
      <form {...formProps} className="mt-4 space-y-3">
        <input type="hidden" name="number" value={number} />
        {k && <input type="hidden" name="k" value={k} />}
        <p className="label">{t.order.returnItems}</p>
        {items.map((i) => (
          <label key={i.id} className="flex items-center justify-between gap-3 text-sm">
            <span>{i.name}</span>
            <select name={`qty_${i.id}`} defaultValue="0" className="input w-20 py-1.5">{Array.from({ length: i.quantity + 1 }, (_, n) => <option key={n}>{n}</option>)}</select>
          </label>
        ))}
        <label className="block"><span className="label">{t.order.returnReason}</span>
          <select name="reason" required className="input" defaultValue=""><option value="" disabled>—</option>{t.order.reasons.map((r) => <option key={r}>{r}</option>)}</select>
        </label>
        <label className="block"><span className="label">{t.order.returnDetails}</span><textarea name="details" rows={2} className="input" /></label>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button className="btn-dark" disabled={pending}>{t.order.returnSubmit}</button>
      </form>
    </details>
  );
}

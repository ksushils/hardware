"use client";
import { useFormAction } from "@/hooks/useFormAction";
import { requestPayout } from "@/app/actions/seller";

export default function PayoutForm({ available, min }: { available: number; min: number }) {
  const { state, pending, formProps } = useFormAction(requestPayout, true);
  return (
    <form {...formProps} className="flex flex-wrap items-end gap-2">
      <label><span className="label">Amount (AED)</span><input name="amount" type="number" step="0.01" min={min} max={available} defaultValue={available >= min ? available : ""} className="in-a w-40" required /></label>
      <button className="btn-a-primary" disabled={pending || available < min}>{pending ? "Requesting…" : "Request payout"}</button>
      {available < min && <p className="w-full text-xs text-slate-500">Minimum withdrawal is AED {min}.</p>}
      {state?.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="w-full text-sm text-emerald-700">{state.ok}</p>}
    </form>
  );
}

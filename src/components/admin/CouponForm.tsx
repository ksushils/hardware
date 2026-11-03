"use client";
import { useFormAction } from "@/hooks/useFormAction";
import { saveCoupon } from "@/app/actions/admin";
export default function CouponForm() {
  const { state, pending, formProps } = useFormAction(saveCoupon, true);
  return (
    <form {...formProps} className="card grid gap-3 p-5 md:grid-cols-6">
      <input name="code" placeholder="CODE" required className="input md:col-span-2" />
      <select name="type" className="input"><option value="PERCENT">% off</option><option value="FIXED">AED off</option></select>
      <input name="value" type="number" step="0.01" placeholder="Value" required className="input" />
      <input name="minSpend" type="number" placeholder="Min spend" className="input" />
      <input name="expiresAt" type="date" className="input" />
      <button className="btn-primary md:col-span-2" disabled={pending}>Save coupon</button>
      {state?.error && <p className="text-sm text-red-600 md:col-span-4">{state.error}</p>}
      {state?.ok && <p className="text-sm text-brand-700 md:col-span-4">{state.ok}</p>}
    </form>
  );
}

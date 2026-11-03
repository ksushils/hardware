"use client";
import { useFormAction } from "@/hooks/useFormAction";
import { saveAddress } from "@/app/actions/account";
import { EMIRATES } from "@/lib/format";

export default function AddressForm() {
  const { state, pending, formProps } = useFormAction(saveAddress, true);
  return (
    <form {...formProps} className="card space-y-3 p-6">
      <h2 className="text-lg font-bold">Add new address</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="fullName" placeholder="Full name" required className="input" />
        <input name="phone" placeholder="Mobile 05X XXX XXXX" required className="input" />
        <select name="emirate" className="input">{EMIRATES.map((e) => <option key={e}>{e}</option>)}</select>
        <input name="area" placeholder="Area / Community" required className="input" />
        <input name="street" placeholder="Street" required className="input" />
        <input name="building" placeholder="Building / Villa & Apt" required className="input" />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-brand-700">{state.ok}</p>}
      <button className="btn-primary" disabled={pending}>Save address</button>
    </form>
  );
}

"use client";
import { useFormAction } from "@/hooks/useFormAction";
import { payWithDemoCard } from "@/app/actions/checkout";

export default function DemoCardForm({ number, total }: { number: string; total: string }) {
  const { state, pending, formProps } = useFormAction(payWithDemoCard);
  const fmtCard = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim();
  };
  const fmtExp = (e: React.ChangeEvent<HTMLInputElement>) => {
    const d = e.target.value.replace(/\D/g, "").slice(0, 4);
    e.target.value = d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };
  return (
    <form {...formProps} className="mt-5 space-y-3">
      <input type="hidden" name="number" value={number} />
      <label className="block"><span className="label">Name on card</span><input name="name" required className="input" autoComplete="cc-name" /></label>
      <label className="block"><span className="label">Card number</span><input name="card" required inputMode="numeric" onChange={fmtCard} placeholder="1234 5678 9012 3456" className="input font-mono" autoComplete="cc-number" /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="label">Expiry</span><input name="exp" required placeholder="MM/YY" onChange={fmtExp} className="input font-mono" autoComplete="cc-exp" /></label>
        <label className="block"><span className="label">CVC</span><input name="cvc" required inputMode="numeric" maxLength={4} placeholder="123" className="input font-mono" autoComplete="cc-csc" /></label>
      </div>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Processing..." : `Pay ${total}`}</button>
      <p className="text-center text-xs text-slate-500">🔒 256-bit encrypted · 3-D Secure</p>
    </form>
  );
}

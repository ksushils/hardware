"use client";
import { useFormAction } from "@/hooks/useFormAction";
import { createGiftCard, updateGiftCard } from "@/app/actions/admin/giftcards";

const lbl = "mb-1 block text-sm font-medium text-slate-700";

export function NewGiftCardForm() {
  const { state, pending, formProps } = useFormAction(createGiftCard);
  return (
    <form {...formProps} className="max-w-2xl space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        <label><span className={lbl}>Initial value (AED)</span><input name="value" type="number" min={1} step="0.01" required className="in-a" defaultValue={100} /></label>
        <label><span className={lbl}>Code</span><input name="code" className="in-a font-mono uppercase" placeholder="Leave blank to auto-generate" /></label>
        <label><span className={lbl}>Customer email (optional)</span><input name="customerEmail" type="email" className="in-a" /></label>
        <label><span className={lbl}>Expiry date (optional)</span><input name="expiresAt" type="date" className="in-a" /></label>
      </div>
      <label className="block"><span className={lbl}>Note / message</span><textarea name="note" className="in-a min-h-16" placeholder="Shown in the email and visible to staff" /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="send" defaultChecked /> Email the gift card to the customer now</label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className="btn-a-primary" disabled={pending}>{pending ? "Issuing…" : "Issue gift card"}</button>
    </form>
  );
}

export function EditGiftCardForm({ card }: { card: { id: string; balance: number; customerEmail: string | null; note: string | null; expiresAt: string; active: boolean } }) {
  const { state, pending, formProps } = useFormAction(updateGiftCard);
  return (
    <form {...formProps} className="space-y-4">
      <input type="hidden" name="id" value={card.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label><span className={lbl}>Balance (AED)</span><input name="balance" type="number" min={0} step="0.01" className="in-a" defaultValue={card.balance} /></label>
        <label><span className={lbl}>Expiry date</span><input name="expiresAt" type="date" className="in-a" defaultValue={card.expiresAt} /></label>
        <label><span className={lbl}>Customer email</span><input name="customerEmail" type="email" className="in-a" defaultValue={card.customerEmail ?? ""} /></label>
        <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="active" defaultChecked={card.active} /> Enabled (can be used at checkout)</label>
      </div>
      <label className="block"><span className={lbl}>Note</span><textarea name="note" className="in-a min-h-16" defaultValue={card.note ?? ""} /></label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-700">{state.ok}</p>}
      <button className="btn-a-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
    </form>
  );
}

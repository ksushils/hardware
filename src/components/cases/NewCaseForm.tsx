"use client";
import { useMemo, useState } from "react";
import { openCase } from "@/app/actions/cases";
import { useFormAction } from "@/hooks/useFormAction";
import { useI18n } from "@/components/I18nProvider";
import { CASE_TYPES, NO_ORDER_TYPES, REQUESTED, resolutionLabel, typeLabel } from "@/lib/caseLabels";

export type NewCaseItem = {
  id: string; name: string; variantTitle: string; quantity: number; sellerName: string | null;
  returnDays: number | null; returnDaysLeft: number | null; warrantyMonths: number | null; warrantyDaysLeft: number | null; delivered: boolean;
};
export type NewCaseOrder = { number: string; date: string; items: NewCaseItem[] };

export default function NewCaseForm({ orders, k, initial }: { orders: NewCaseOrder[]; k?: string; initial: { order?: string; item?: string; type?: string } }) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const { state, pending, formProps } = useFormAction(openCase);
  const first = orders.find((o) => o.number === initial.order) ?? orders[0];
  const [orderNo, setOrderNo] = useState(first?.number ?? "");
  const order = orders.find((o) => o.number === orderNo);
  const [itemId, setItemId] = useState(initial.item && order?.items.some((i) => i.id === initial.item) ? initial.item : order?.items.length === 1 ? order.items[0].id : "");
  const [type, setType] = useState(initial.type && (CASE_TYPES as readonly string[]).includes(initial.type) ? initial.type : "");
  const item = order?.items.find((i) => i.id === itemId);
  const noOrderOk = NO_ORDER_TYPES.includes(type as never);
  const [qty, setQty] = useState(1);
  const hint = useMemo(() => {
    if (!item) return null;
    const bits: string[] = [];
    if (item.returnDays != null) bits.push(item.delivered && item.returnDaysLeft != null ? (item.returnDaysLeft > 0 ? (ar ? `نافذة الإرجاع (${item.returnDays} يومًا) متبقي منها ${item.returnDaysLeft} يومًا.` : `Return window (${item.returnDays} days): ${item.returnDaysLeft} days left.`) : (ar ? `انتهت نافذة الإرجاع (${item.returnDays} يومًا)، لكن يمكنك فتح طلب إذا كان المنتج معيبًا أو مختلفًا عن الوصف.` : `The ${item.returnDays}-day return window has ended, but you can still open a case if the item is faulty or not as described.`)) : ar ? `نافذة الإرجاع ${item.returnDays} يومًا من الاستلام.` : `Return window: ${item.returnDays} days from delivery.`);
    if (item.warrantyMonths) bits.push(item.warrantyDaysLeft != null && item.delivered ? (item.warrantyDaysLeft > 0 ? (ar ? `الضمان (${item.warrantyMonths} شهرًا): متبقي ${item.warrantyDaysLeft} يومًا.` : `Warranty (${item.warrantyMonths} months): ${item.warrantyDaysLeft} days left.`) : (ar ? "انتهت فترة الضمان المسجلة وقت الشراء." : "The warranty recorded at purchase has ended.")) : ar ? `ضمان ${item.warrantyMonths} شهرًا.` : `${item.warrantyMonths}-month warranty.`);
    return bits;
  }, [item, ar]);

  return (
    <form {...formProps} encType="multipart/form-data" className="card space-y-5 p-6">
      {k && <input type="hidden" name="k" value={k} />}
      {(!orders.length || orders.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">{ar ? "الطلب" : "Order"}</span>
            {orders.length === 1 && k ? <><input type="hidden" name="order" value={orders[0].number} /><p className="input bg-slate-50" dir="ltr">{orders[0].number}</p></> : (
              <select name="order" value={orderNo} onChange={(e) => { setOrderNo(e.target.value); setItemId(""); }} className="input">
                {noOrderOk && <option value="">{ar ? "ليس بخصوص طلب محدد" : "Not about a specific order"}</option>}
                {orders.map((o) => <option key={o.number} value={o.number}>{o.number} · {o.date}</option>)}
              </select>
            )}
          </label>
          <label className="block">
            <span className="label">{ar ? "المنتج" : "Item"}</span>
            <select name="item" value={itemId} onChange={(e) => { setItemId(e.target.value); setQty(1); }} className="input" disabled={!order}>
              <option value="">{ar ? "الطلب كله / غير محدد" : "Whole order / not sure"}</option>
              {order?.items.map((i) => <option key={i.id} value={i.id}>{i.name}{i.variantTitle ? ` (${i.variantTitle})` : ""}</option>)}
            </select>
          </label>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">{ar ? "ما المشكلة؟" : "What went wrong?"}</span>
          <select name="type" value={type} onChange={(e) => setType(e.target.value)} required className="input">
            <option value="" disabled>{ar ? "اختر…" : "Choose…"}</option>
            {CASE_TYPES.map((t) => <option key={t} value={t}>{typeLabel(t, locale)}</option>)}
          </select>
        </label>
        {item && item.quantity > 1 && (
          <label className="block">
            <span className="label">{ar ? "عدد القطع المتأثرة" : "How many units are affected?"}</span>
            <select name="quantity" value={qty} onChange={(e) => setQty(Number(e.target.value))} className="input">{Array.from({ length: item.quantity }, (_, n) => <option key={n + 1} value={n + 1}>{n + 1}</option>)}</select>
          </label>
        )}
      </div>

      {hint && hint.length > 0 && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
          <p className="font-semibold">ℹ️ {ar ? "معلومة مفيدة" : "Good to know"}{item?.sellerName ? ` · ${item.sellerName}` : ""}</p>
          <ul className="mt-1 list-disc ps-5">{hint.map((h) => <li key={h}>{h}</li>)}</ul>
          <p className="mt-1 text-xs text-sky-800">{ar ? "هذه معلومات فقط: حقوقك القانونية كمستهلك تسري دائمًا ولن نمنعك من فتح طلب." : "This is information only. Your statutory consumer rights always apply and nothing here stops you opening a case."}</p>
        </div>
      )}

      <fieldset>
        <legend className="label">{ar ? "ماذا تفضل؟" : "What would you like?"}</legend>
        <div className="flex flex-wrap gap-2">
          {REQUESTED.map((r, i) => (
            <label key={r} className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50">
              <input type="radio" name="requested" value={r} defaultChecked={i === 0} className="accent-brand-600" /> {resolutionLabel(r, locale)}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="label">{ar ? "اشرح لنا ما حدث" : "Tell us what happened"}</span>
        <textarea name="reason" rows={5} required minLength={10} className="input" placeholder={ar ? "كلما كانت التفاصيل أكثر، كان الحل أسرع." : "The more detail you give, the faster we can help."} />
      </label>
      <label className="block">
        <span className="label">{ar ? "صور أو ملفات (اختياري)" : "Photos or documents (optional)"}</span>
        <input type="file" name="files" multiple accept=".pdf,.png,.jpg,.jpeg,.webp" className="block w-full text-sm file:me-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm" />
        <span className="mt-1 block text-xs text-slate-500">{ar ? "PDF أو PNG أو JPG أو WebP، حتى 5 ملفات (10 ميغابايت لكل ملف). لا يراها إلا فريق الدعم والبائع المعني." : "PDF, PNG, JPG or WebP, up to 5 files (10MB each). Only Karat support and the seller involved can see them."}</span>
      </label>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{state.error}</p>}
      <button className="btn-primary" disabled={pending}>{pending ? (ar ? "جارٍ الإرسال…" : "Sending…") : ar ? "إرسال الطلب" : "Open case"}</button>
    </form>
  );
}

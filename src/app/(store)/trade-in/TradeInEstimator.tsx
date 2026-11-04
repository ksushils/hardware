"use client";
import { useMemo, useState } from "react";
import { useFormAction } from "@/hooks/useFormAction";
import { submitTradeIn } from "@/app/actions/account";
import { aed, EMIRATES, EMIRATES_AR, loc } from "@/lib/format";
import { useI18n } from "@/components/I18nProvider";

type Model = { id: string; cat: string; catName: string; catNameAr: string; name: string; priceNew: number; resale: number };
const CONDITIONS: [string, string, string, number][] = [
  ["like-new", "Like new, boxed", "كالجديد مع العلبة", 1], ["good", "Good, light wear", "جيد، استخدام خفيف", 0.85], ["fair", "Fair, visible wear", "مقبول، آثار ظاهرة", 0.65], ["faulty", "Faulty / for parts", "معطل / قطع غيار", 0.2],
];
const AGES: [string, string, string, number][] = [["<1", "Under 1 year", "أقل من سنة", 1], ["1-2", "1–2 years", "1–2 سنة", 0.85], ["2-4", "2–4 years", "2–4 سنوات", 0.7], ["4+", "Over 4 years", "أكثر من 4 سنوات", 0.5]];

export default function TradeInEstimator({ models }: { models: Model[] }) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const cats = useMemo(() => [...new Map(models.map((m) => [m.cat, m])).values()], [models]);
  const [cat, setCat] = useState(cats[0]?.cat ?? "");
  const [modelId, setModelId] = useState("");
  const [custom, setCustom] = useState({ name: "", price: "" });
  const [cond, setCond] = useState("good");
  const [age, setAge] = useState("1-2");
  const [box, setBox] = useState(true);
  const { state, pending, formProps } = useFormAction(submitTradeIn);
  const model = models.find((m) => m.id === modelId);
  const basis = model ? model.resale : Number(custom.price) * 0.55;
  const factor = (CONDITIONS.find((c) => c[0] === cond)?.[3] ?? 1) * (AGES.find((a) => a[0] === age)?.[3] ?? 1) * (box ? 1 : 0.95);
  const cash = Math.max(0, Math.round((basis * 0.6 * factor) / 5) * 5);
  const credit = Math.round(cash * 1.1);
  const modelName = model?.name ?? custom.name;

  if (state?.ok) return <div className="container-x max-w-xl py-20 text-center"><p className="text-5xl">♻️</p><h1 className="mt-4 text-2xl font-black">{state.ok}</h1></div>;
  return (
    <div className="container-x py-10">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-black md:text-4xl">♻️ {ar ? "استبدل قطعك القديمة" : "Trade in your old hardware"}</h1>
        <p className="mt-2 text-slate-600">{ar ? "احصل على تقدير فوري. استلام مجاني من أي مكان في الإمارات والدفع خلال يومين — أو رصيد شراء أعلى بـ 10%." : "Get an instant estimate. Free collection anywhere in the UAE, paid within 2 days, or take 10% extra as store credit."}</p>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="card space-y-6 p-6">
          <div>
            <p className="label">1. {ar ? "الفئة" : "Category"}</p>
            <div className="flex flex-wrap gap-2">
              {cats.map((c) => <button key={c.cat} type="button" onClick={() => { setCat(c.cat); setModelId(""); }} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${cat === c.cat ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-300"}`}>{loc(locale, c.catName, c.catNameAr)}</button>)}
            </div>
          </div>
          <div>
            <p className="label">2. {ar ? "الموديل" : "Model"}</p>
            <select value={modelId} onChange={(e) => setModelId(e.target.value)} className="input">
              <option value="">{ar ? "موديل آخر (أدخله يدويًا)" : "Other model (enter manually)"}</option>
              {models.filter((m) => m.cat === cat).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            {!model && (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <input value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} placeholder={ar ? "اسم الموديل" : "Model name, e.g. RTX 3070"} className="input" />
                <input value={custom.price} onChange={(e) => setCustom({ ...custom, price: e.target.value })} type="number" placeholder={ar ? "سعره جديدًا (درهم)" : "Original price (AED)"} className="input" />
              </div>
            )}
          </div>
          <div>
            <p className="label">3. {ar ? "الحالة" : "Condition"}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {CONDITIONS.map(([k, en, a]) => <button key={k} type="button" onClick={() => setCond(k)} className={`rounded-xl border-2 p-3 text-start text-sm font-semibold ${cond === k ? "border-brand-600 bg-brand-50" : "border-slate-200"}`}>{ar ? a : en}</button>)}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className="label">4. {ar ? "العمر" : "Age"}</span><select value={age} onChange={(e) => setAge(e.target.value)} className="input">{AGES.map(([k, en, a]) => <option key={k} value={k}>{ar ? a : en}</option>)}</select></label>
            <label className="flex items-end gap-2 pb-3 text-sm"><input type="checkbox" checked={box} onChange={(e) => setBox(e.target.checked)} className="accent-brand-600" /> {ar ? "مع العلبة والملحقات" : "Original box & accessories"}</label>
          </div>
        </div>
        <aside className="card h-fit space-y-4 p-6 lg:sticky lg:top-36">
          <p className="text-sm text-slate-500">{ar ? "التقدير الفوري" : "Instant estimate"}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{ar ? "نقدًا" : "Cash"}</p><p className="text-2xl font-black">{aed(cash, locale)}</p></div>
            <div className="rounded-xl bg-brand-50 p-3"><p className="text-xs text-brand-700">{ar ? "رصيد شراء +10%" : "Store credit +10%"}</p><p className="text-2xl font-black text-brand-700">{aed(credit, locale)}</p></div>
          </div>
          <p className="text-xs text-slate-500">{ar ? "القيمة النهائية تُؤكد بعد الفحص. العرض صالح 14 يومًا." : "Final value confirmed after inspection. Quote valid for 14 days."}</p>
          <form {...formProps} className="space-y-2 border-t pt-4">
            <input type="hidden" name="category" value={cat} /><input type="hidden" name="model" value={modelName} /><input type="hidden" name="condition" value={`${cond}, ${age}${box ? ", boxed" : ""}`} /><input type="hidden" name="estimate" value={cash} />
            <input name="name" required placeholder={ar ? "الاسم" : "Full name"} className="input py-2" />
            <input name="email" type="email" required placeholder={ar ? "البريد الإلكتروني" : "Email"} className="input py-2" />
            <input name="phone" required dir="ltr" placeholder="05X XXX XXXX" className="input py-2 text-start" />
            <select name="emirate" className="input py-2">{EMIRATES.map((e) => <option key={e} value={e}>{ar ? EMIRATES_AR[e] : e}</option>)}</select>
            <select name="payout" className="input py-2"><option value="CREDIT">{ar ? `رصيد شراء (${aed(credit, locale)})` : `Store credit (${aed(credit, locale)})`}</option><option value="CASH">{ar ? `تحويل بنكي (${aed(cash, locale)})` : `Bank transfer (${aed(cash, locale)})`}</option></select>
            <textarea name="details" rows={2} placeholder={ar ? "تفاصيل إضافية (اختياري)" : "Anything we should know? (optional)"} className="input py-2" />
            {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
            <button className="btn-primary w-full" disabled={pending || !modelName || cash <= 0}>{ar ? "اطلب الاستلام المجاني" : "Book free collection"}</button>
          </form>
        </aside>
      </div>
    </div>
  );
}

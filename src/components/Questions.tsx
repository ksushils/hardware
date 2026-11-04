"use client";
import { useFormAction } from "@/hooks/useFormAction";
import { askQuestion } from "@/app/actions/account";
import { useI18n } from "./I18nProvider";

export default function Questions({ productId, questions }: { productId: string; questions: { id: string; name: string; question: string; answer: string | null }[] }) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const { state, pending, formProps } = useFormAction(askQuestion, true);
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold">{ar ? "أسئلة وأجوبة" : "Questions & answers"}</h2>
      <div className="mt-3 space-y-3">
        {questions.length === 0 && <p className="text-sm text-slate-500">{ar ? "لا توجد أسئلة بعد." : "No questions yet. Ask about compatibility, condition or warranty."}</p>}
        {questions.map((q) => (
          <div key={q.id} className="card p-4 text-sm">
            <p><b>{ar ? "س:" : "Q:"}</b> {q.question} <span className="text-xs text-slate-400">— {q.name}</span></p>
            {q.answer && <p className="mt-2 text-slate-700"><b className="text-brand-700">{ar ? "ج:" : "A:"}</b> {q.answer}</p>}
          </div>
        ))}
      </div>
      <details className="card mt-3 p-4">
        <summary className="cursor-pointer text-sm font-semibold">{ar ? "اطرح سؤالاً" : "Ask a question"}</summary>
        <form {...formProps} className="mt-3 space-y-2">
          <input type="hidden" name="productId" value={productId} />
          <div className="grid gap-2 sm:grid-cols-2">
            <input name="name" required placeholder={ar ? "الاسم" : "Your name"} className="input py-2" />
            <input name="email" type="email" required placeholder={ar ? "البريد الإلكتروني (لن يُنشر)" : "Email (not published)"} className="input py-2" />
          </div>
          <textarea name="question" required minLength={8} rows={2} placeholder={ar ? "مثال: هل يتوافق مع لوحة B550؟" : "e.g. Will this fit a B550 board?"} className="input" />
          {state?.ok && <p className="text-sm text-brand-700">{state.ok}</p>}
          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
          <button className="btn-dark py-2" disabled={pending}>{ar ? "إرسال" : "Submit question"}</button>
        </form>
      </details>
    </section>
  );
}

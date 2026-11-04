import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { CONDITION_TYPE_LABEL, EVIDENCE_LABEL, FACTOR_TEXT, L, WARRANTY_PROVIDER_LABEL, WEIGHTS, type Factor } from "@/lib/offers";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  return {
    title: locale === "ar" ? "دليل الحالة والأدلة وترتيب العروض" : "Condition grading, evidence & how offers are ranked",
    description: locale === "ar" ? "كيف نصف حالة الأجهزة، وما الذي يقف خلف كل معلومة، وكيف نرتب العروض." : "How we describe condition, who stands behind each data point, and how seller offers are ranked.",
    alternates: { canonical: "/grading" },
  };
}

export default async function GradingPage() {
  const [{ locale }, s] = await Promise.all([getI18n(), getSettings()]);
  const ar = locale === "ar";
  const T = (en: string, a: string) => (ar ? a : en);
  const types: [string, string, string][] = [
    ["NEW", "Sealed or never used, with the manufacturer's packaging and warranty where applicable.", "مغلق أو غير مستخدم، مع تغليف الشركة المصنعة وضمانها حيثما ينطبق."],
    ["OPEN_BOX", "Box opened, little or no use. Cosmetically like new; accessories as stated by the seller.", "تم فتح العلبة مع استخدام قليل أو معدوم. يبدو كالجديد؛ والملحقات كما يذكرها البائع."],
    ["REFURBISHED", "Inspected, cleaned and tested (and repaired where needed) by the seller before resale. Repairs and replaced parts must be disclosed.", "فحصه البائع ونظفه واختبره (وأصلحه عند الحاجة) قبل إعادة البيع. يجب الإفصاح عن الإصلاحات والأجزاء المستبدلة."],
    ["USED", "Previously used, sold as is with the disclosed condition.", "مستعمل سابقًا ويُباع بحالته المُعلنة."],
    ["PARTS", "Not sold as working retail stock: for spares or repair only.", "غير مخصص كمنتج عامل؛ للقطع أو الإصلاح فقط."],
  ];
  const grades: [string, string, string, string][] = [
    ["Excellent", "ممتاز", "No visible signs of use under normal viewing.", "لا توجد آثار استخدام ظاهرة عند النظر العادي."],
    ["Very good", "جيد جدًا", "Light signs of use, clearly disclosed; usually invisible once installed.", "آثار استخدام خفيفة مُعلنة بوضوح، وغالبًا لا تظهر بعد التركيب."],
    ["Good", "جيد", "Visible wear consistent with the seller's description; fully functional.", "آثار استخدام ظاهرة تتفق مع وصف البائع، ويعمل بالكامل."],
  ];
  return (
    <article className="container-x max-w-3xl py-12">
      <h1 className="text-4xl font-black tracking-tight">{T("Condition, evidence & offer ranking", "الحالة والأدلة وترتيب العروض")}</h1>
      <p className="mt-3 text-slate-600">{T("Several sellers can offer the same product. Every offer shows its own condition, evidence and terms, so you can compare like with like.", "يمكن لعدة بائعين عرض المنتج نفسه. يعرض كل عرض حالته وأدلته وشروطه، لتقارن بين عروض متشابهة.")}</p>

      <h2 className="mt-10 text-2xl font-bold">{T("1. Commercial condition", "1. الحالة التجارية")}</h2>
      <dl className="mt-3 space-y-3">
        {types.map(([k, en, a]) => <div key={k} className="card p-4"><dt className="font-semibold">{L(CONDITION_TYPE_LABEL[k], locale)}</dt><dd className="mt-1 text-sm text-slate-600">{T(en, a)}</dd></div>)}
      </dl>

      <h2 className="mt-10 text-2xl font-bold">{T("2. Cosmetic grade", "2. الدرجة الشكلية")}</h2>
      <p className="mt-2 text-sm text-slate-600">{T("The grade describes appearance only. It says nothing about battery, performance or warranty, which are shown separately. A cosmetically excellent device does not automatically have an excellent battery.", "تصف الدرجة المظهر فقط، ولا تعبّر عن البطارية أو الأداء أو الضمان التي تُعرض بشكل منفصل. الجهاز الممتاز شكليًا ليس بالضرورة ممتاز البطارية.")}</p>
      <dl className="mt-3 space-y-3">
        {grades.map(([en, a, d, da]) => <div key={en} className="card p-4"><dt className="font-semibold">{T(en, a)}</dt><dd className="mt-1 text-sm text-slate-600">{T(d, da)}</dd></div>)}
      </dl>

      <h2 className="mt-10 text-2xl font-bold">{T("3. Evidence: who stands behind each fact", "3. الأدلة: من المسؤول عن كل معلومة")}</h2>
      <ul className="mt-3 space-y-3 text-sm">
        <li className="card p-4"><b className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">{L(EVIDENCE_LABEL.verified, locale)}</b><p className="mt-2 text-slate-600">{T("Our team (or a named lab) checked the unit and recorded who and when. Shown only when evidence exists and the verifier is named.", "فحص فريقنا (أو مختبر مسمّى) القطعة وسجّل من وكيف ومتى. يظهر فقط عند وجود أدلة وتسمية الجهة المتحققة.")}</p></li>
        <li className="card p-4"><b className="rounded-full bg-slate-100 px-2 py-0.5">{L(EVIDENCE_LABEL.declared, locale)}</b><p className="mt-2 text-slate-600">{T("The seller entered this and declared it accurate. We have not independently verified it.", "أدخل البائع هذه المعلومة وأقر بصحتها، ولم نتحقق منها بشكل مستقل.")}</p></li>
        <li className="card p-4"><b className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">{L(EVIDENCE_LABEL.none, locale)}</b><p className="mt-2 text-slate-600">{T("No information was provided. We never fill gaps with assumptions: “not supplied” is shown honestly.", "لم تُقدَّم معلومات. لا نملأ الفراغات بافتراضات، ونعرض «غير متوفر» بصدق.")}</p></li>
      </ul>
      <p className="mt-3 text-sm text-slate-600">{T("Photos labelled “Photos of this exact unit” show the unit you will receive. A catalogue image on a used or refurbished offer may not.", "الصور المكتوب عليها «صور هذه القطعة تحديدًا» تُظهر القطعة التي ستستلمها، أما صورة الكتالوج في عرض مستعمل أو مُجدد فقد لا تفعل.")}</p>

      <h2 className="mt-10 text-2xl font-bold">{T("4. Warranty and returns", "4. الضمان والإرجاع")}</h2>
      <ul className="mt-3 list-disc space-y-1 ps-6 text-sm text-slate-700">
        <li>{T("Each offer states who provides the warranty:", "يوضح كل عرض الجهة التي تقدم الضمان:")} {Object.values(WARRANTY_PROVIDER_LABEL).map((p) => L(p, locale)).join(" · ")}. {T("A seller warranty is never presented as the manufacturer's.", "لا يُقدَّم ضمان البائع على أنه ضمان الشركة المصنعة.")}</li>
        <li>{T(`Sellers cannot offer a return window shorter than ${s.returnsDays} days, and your statutory rights are never reduced.`, `لا يمكن للبائع تقديم مهلة إرجاع أقصر من ${s.returnsDays} يومًا، ولا تُنتقص حقوقك القانونية.`)}</li>
        <li>{T("The warranty and return terms you saw are saved with your order. Later seller edits cannot reduce them.", "تُحفظ شروط الضمان والإرجاع التي رأيتها مع طلبك، ولا يمكن لتعديلات البائع اللاحقة أن تنتقص منها.")}</li>
      </ul>

      <h2 id="ranking" className="mt-10 scroll-mt-32 text-2xl font-bold">{T("5. How offers are ranked", "5. كيف نرتب العروض")}</h2>
      <p className="mt-2 text-sm text-slate-600">{T("When there are several offers for the same specification, the “Recommended” one is the highest score out of 100. Price is only 40 of those points.", "عند وجود عدة عروض للمواصفات نفسها، فإن «الموصى به» هو الأعلى نقاطًا من 100. والسعر 40 نقطة فقط منها.")}</p>
      <table className="card mt-3 w-full overflow-hidden text-sm">
        <thead className="bg-slate-50 text-start"><tr><th className="p-3 text-start">{T("Factor", "العامل")}</th><th className="p-3 text-start">{T("Max points", "أقصى نقاط")}</th><th className="p-3 text-start">{T("How it is scored", "طريقة التقييم")}</th></tr></thead>
        <tbody className="divide-y">
          {(Object.keys(WEIGHTS) as Factor[]).map((f) => (
            <tr key={f}><td className="p-3 font-medium">{ar ? FACTOR_TEXT[f][1] : FACTOR_TEXT[f][0]}</td><td className="p-3">{WEIGHTS[f]}</td><td className="p-3 text-slate-600">{ar ? FACTOR_TEXT[f][3] : FACTOR_TEXT[f][2]}</td></tr>
          ))}
        </tbody>
      </table>
      <ul className="mt-3 list-disc space-y-1 ps-6 text-sm text-slate-700">
        <li>{T("Prices compared are the offer prices (VAT included). Delivery charges depend on your address and are shown at checkout.", "الأسعار المقارنة هي أسعار العروض (شاملة الضريبة). تعتمد رسوم التوصيل على عنوانك وتظهر عند الدفع.")}</li>
        <li>{T("Sold-out offers are never recommended.", "لا يُوصى أبدًا بالعروض النافدة.")}</li>
        <li>{T("Sellers cannot pay to be ranked higher. If sponsored placement is ever introduced it will be labelled and kept separate from this ranking.", "لا يمكن للبائعين الدفع للحصول على ترتيب أعلى. وإن أُدخل ترويج مدفوع يومًا فسيكون موسومًا ومنفصلًا عن هذا الترتيب.")}</li>
        <li>{T("You can always choose a different offer or compare up to four side by side.", "يمكنك دائمًا اختيار عرض آخر أو مقارنة حتى أربعة عروض جنبًا إلى جنب.")}</li>
      </ul>
      <p className="mt-8"><Link href="/deals" className="btn-primary">{T("Browse deals", "تصفح العروض")}</Link></p>
    </article>
  );
}

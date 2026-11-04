import type { Metadata } from "next";
import Link from "next/link";
import { getI18n, fmt } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { loc } from "@/lib/format";
import { JsonLd } from "@/components/JsonLd";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.help.title, alternates: { canonical: "/help" } };
}

export default async function Help() {
  const [{ t, locale }, s] = await Promise.all([getI18n(), getSettings()]);
  return (
    <div className="container-x max-w-3xl py-12">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: t.help.faqs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }} />
      <h1 className="text-4xl font-black tracking-tight">{t.help.title}</h1>
      <p className="mt-4 text-slate-700">{fmt(t.help.contact, { email: s.email, phone: s.phone, hours: loc(locale, s.hours, s.hoursAr) })} <Link href="/track" className="font-semibold text-brand-700 underline">{t.header.trackOrder}</Link></p>
      <h2 id="delivery" className="mt-10 text-2xl font-bold">{t.help.delivery}</h2>
      <ul className="mt-3 list-disc space-y-1 ps-6 text-slate-700">{t.help.deliveryItems.map((x) => <li key={x}>{x}</li>)}</ul>
      <h2 id="warranty" className="mt-10 text-2xl font-bold">{t.help.warranty}</h2>
      <ul className="mt-3 list-disc space-y-1 ps-6 text-slate-700">{t.help.warrantyItems.map((x) => <li key={x}>{x}</li>)}</ul>
      <h2 className="mt-10 text-2xl font-bold">{t.help.faq}</h2>
      <div className="mt-3 space-y-2">
        {t.help.faqs.map(([q, a]) => <details key={q} className="card p-4"><summary className="cursor-pointer font-semibold">{q}</summary><p className="mt-2 text-sm text-slate-700">{a}</p></details>)}
      </div>
    </div>
  );
}

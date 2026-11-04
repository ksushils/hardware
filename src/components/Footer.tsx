import Link from "next/link";
import { getI18n } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { loc } from "@/lib/format";
import NewsletterForm from "./NewsletterForm";

export default async function Footer() {
  const [{ t, locale }, s] = await Promise.all([getI18n(), getSettings()]);
  const socials = Object.entries(s.social).filter(([, v]) => v);
  return (
    <footer className="mt-20 bg-ink-900 text-slate-300">
      <div className="border-b border-white/10">
        <div className="container-x flex flex-col items-start justify-between gap-4 py-10 md:flex-row md:items-center">
          <div>
            <p className="text-xl font-bold text-white">{t.footer.newsletter}</p>
            <p className="text-sm">{t.footer.newsletterSub}</p>
          </div>
          <NewsletterForm />
        </div>
      </div>
      <div className="container-x grid gap-10 py-14 md:grid-cols-4">
        <div>
          <p className="text-xl font-black text-white" dir="ltr">Tech<span className="text-brand-500">Revive</span></p>
          <p className="mt-3 text-sm leading-relaxed">{t.footer.about}</p>
          <p className="mt-4 space-y-1 text-sm">
            <span className="block">📍 {loc(locale, s.address, s.addressAr)}</span>
            <span className="block" dir="ltr">📞 {s.phone}</span>
            <span className="block">✉️ {s.email}</span>
            <span className="block">🕘 {loc(locale, s.hours, s.hoursAr)}</span>
          </p>
          {socials.length > 0 && (
            <div className="mt-4 flex gap-3 text-sm">
              {socials.map(([k, v]) => <a key={k} href={v} target="_blank" rel="noopener noreferrer" className="capitalize hover:text-white">{k}</a>)}
            </div>
          )}
        </div>
        <FooterCol title={t.footer.shop} links={[[t.header.hotDeals, "/deals"], [locale === "ar" ? "جمّع جهازك" : "PC Builder", "/build"], [t.header.collections, "/collections"], [locale === "ar" ? "مقارنة المنتجات" : "Compare products", "/compare"], [t.header.blog, "/blog"]]} />
        <FooterCol title={t.footer.help} links={[[t.header.helpCenter, "/help"], [t.header.trackOrder, "/track"], [t.footer.warrantyReturns, "/pages/warranty"], [t.footer.delivery, "/help#delivery"], [locale === "ar" ? "قيّم جهازك للاستبدال" : "Trade-in estimator", "/trade-in"]]} />
        <FooterCol title={t.footer.company} links={[[locale === "ar" ? "🏪 كن بائعًا" : "🏪 Become a seller", "/become-a-seller"], [locale === "ar" ? "تصفح المتاجر" : "Browse seller shops", "/sellers"], ...s.footerMenu.map((m) => [loc(locale, m.label, m.labelAr), m.url] as [string, string]), [t.footer.myAccount, "/account"]]} />
      </div>
      <div className="border-t border-white/10">
        <div className="container-x flex flex-col items-center justify-between gap-4 py-6 text-xs md:flex-row">
          <p>© {new Date().getFullYear()} {s.legalName}. {t.footer.rights}{s.trn ? ` TRN ${s.trn}` : ""}</p>
          <Link href="/become-a-seller" className="rounded-full bg-brand-600 px-4 py-1.5 font-semibold text-white hover:bg-brand-500">🏪 {locale === "ar" ? "كن بائعًا على تك ريفايف" : "Become a seller on TechRevive"}</Link>
          <div className="flex flex-wrap gap-2" dir="ltr">
            {["VISA", "Mastercard", "Apple Pay", "Google Pay", "COD"].map((p) => <span key={p} className="rounded-md bg-white/10 px-2.5 py-1 font-semibold text-white">{p}</span>)}
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="font-semibold text-white">{title}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map(([l, h]) => <li key={h + l}><Link href={h} className="hover:text-white">{l}</Link></li>)}
      </ul>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { getSellerForUser } from "@/lib/sellerAuth";
import { db } from "@/lib/db";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  return {
    title: locale === "ar" ? "بِع على تك ريفايف — سوق قطع الكمبيوتر في الإمارات" : "Sell on TechRevive: the UAE's PC hardware marketplace",
    description: locale === "ar" ? "افتح متجرك واعرض قطع الكمبيوتر الجديدة والمُجددة لآلاف المشترين في الإمارات." : "Open your shop and reach thousands of PC buyers across the UAE. Free to join, pay commission only when you sell.",
    alternates: { canonical: "/become-a-seller" },
  };
}

export default async function BecomeSeller() {
  const { locale } = await getI18n();
  const ar = locale === "ar";
  const [s, { user, seller }, sellerCount] = await Promise.all([getSettings(), getSellerForUser(), db.seller.count({ where: { status: "APPROVED" } })]);
  const m = s.marketplace;
  const cta = seller ? { href: seller.status === "APPROVED" ? "/seller" : "/seller/status", label: ar ? "اذهب إلى لوحة البائع" : "Go to your seller portal" }
    : user ? { href: "/become-a-seller/apply", label: ar ? "قدّم طلبك الآن" : "Apply now" }
    : { href: "/register?next=/become-a-seller/apply", label: ar ? "أنشئ حسابًا للبدء" : "Create an account to start" };
  const benefits: [string, string, string][] = ar ? [
    ["🛒", "آلاف المشترين", "اعرض منتجاتك لعملاء يبحثون عن قطع الكمبيوتر في جميع الإمارات."],
    ["💸", "ادفع فقط عند البيع", `التسجيل مجاني. عمولة تبدأ من ${m.defaultCommissionPercent}% على المبيعات فقط.`],
    ["🚚", "توصيل ودفع عند الاستلام", "نحن نتولى الدفع الإلكتروني والدفع عند الاستلام وخدمة العملاء."],
    ["📊", "لوحة بائع متكاملة", "إدارة المنتجات والطلبات والأرباح والسحوبات من مكان واحد."],
  ] : [
    ["🛒", "Thousands of buyers", "List your parts in front of shoppers searching for PC hardware across all 7 emirates."],
    ["💸", "Pay only when you sell", `Free to join. Commission from ${m.defaultCommissionPercent}% on completed sales, with no monthly fees.`],
    ["🚚", "Payments & COD handled", "We take card, Apple Pay and cash on delivery, and handle customer support and returns."],
    ["📊", "Powerful seller portal", "Manage products, orders, earnings and payouts in one dashboard."],
  ];
  const steps = ar
    ? ["أنشئ حسابك وقدّم طلب البائع مع رخصتك التجارية", "يراجع فريقنا طلبك خلال يومي عمل", "أضف منتجاتك — نراجعها وننشرها", "اشحن الطلبات واسحب أرباحك إلى حسابك البنكي"]
    : ["Create an account and apply with your trade licence", "Our team reviews your application within 2 business days", "Add products. We review and publish them", "Ship orders and withdraw earnings to your UAE bank account"];
  return (
    <div>
      <section className="bg-gradient-to-br from-violet-950 via-ink-900 to-brand-700 text-white">
        <div className="container-x py-16 md:py-24">
          <p className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">🏪 {ar ? "سوق تك ريفايف" : "TechRevive Marketplace"}</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight md:text-6xl">{ar ? "بِع قطع الكمبيوتر لعملاء في كل الإمارات" : "Sell PC hardware to buyers across the UAE"}</h1>
          <p className="mt-4 max-w-xl text-lg text-slate-300">{ar ? "انضم إلى البائعين الموثوقين وابدأ البيع خلال أيام." : `Join ${sellerCount || "our"} trusted sellers and start selling within days.`}</p>
          <Link href={cta.href} className="btn mt-8 bg-brand-600 text-white hover:bg-brand-500">{cta.label}</Link>
        </div>
      </section>
      <section className="container-x mt-12 grid gap-4 md:grid-cols-4">
        {benefits.map(([i, t, d]) => <div key={t} className="card p-5"><p className="text-3xl">{i}</p><p className="mt-2 font-bold">{t}</p><p className="mt-1 text-sm text-slate-600">{d}</p></div>)}
      </section>
      <section className="container-x mt-14 grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="h-section">{ar ? "كيف يعمل" : "How it works"}</h2>
          <ol className="mt-5 space-y-4">
            {steps.map((st, i) => <li key={i} className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-600 font-bold text-white">{i + 1}</span><p className="pt-1">{st}</p></li>)}
          </ol>
        </div>
        <div className="card p-6">
          <h2 className="text-xl font-bold">{ar ? "العمولة والمدفوعات" : "Commission & payouts"}</h2>
          <ul className="mt-3 list-disc space-y-2 ps-5 text-sm text-slate-700">
            <li>{ar ? `عمولة افتراضية ${m.defaultCommissionPercent}% من سعر البيع (قد تختلف حسب الفئة).` : `Default commission of ${m.defaultCommissionPercent}% of the sale price (some categories have lower rates).`}</li>
            <li>{ar ? `تصبح الأرباح متاحة بعد ${m.holdDays} يومًا من التوصيل.` : `Earnings become available ${m.holdDays} days after delivery, once the return window has passed.`}</li>
            <li>{ar ? `الحد الأدنى للسحب ${m.minPayout} درهم عبر تحويل بنكي.` : `Withdraw from AED ${m.minPayout} by bank transfer to your UAE IBAN.`}</li>
          </ul>
          <h3 className="mt-5 font-semibold">{ar ? "متطلبات البائع" : "Seller requirements"}</h3>
          <p className="mt-1 text-sm text-slate-600">{ar ? m.sellerTermsAr : m.sellerTerms}</p>
          <Link href={cta.href} className="btn-primary mt-5 w-full">{cta.label}</Link>
        </div>
      </section>
    </div>
  );
}

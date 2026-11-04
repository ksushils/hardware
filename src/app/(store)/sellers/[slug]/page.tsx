import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n";
import { getUser } from "@/lib/auth";
import { productInclude, visibleWhere } from "@/lib/catalog";
import { EMIRATES_AR, loc } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";
import { siteUrl } from "@/lib/site";
import { ProductGrid } from "@/components/ProductCard";
import { JsonLd, BreadcrumbJsonLd } from "@/components/JsonLd";
import { ContactSellerForm, RateSellerForm } from "@/components/marketplace/SellerForms";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await getI18n();
  const s = await db.seller.findUnique({ where: { slug: (await params).slug } });
  if (!s || s.status !== "APPROVED") return {};
  const about = loc(locale, s.about, s.aboutAr);
  return {
    title: locale === "ar" ? `${s.shopName} — متجر على تك ريفايف` : `${s.shopName}: shop on TechRevive Marketplace`,
    description: about.slice(0, 155) || `Buy PC hardware from ${s.shopName} in ${s.emirate}, UAE.`,
    alternates: { canonical: `/sellers/${s.slug}` },
    openGraph: { images: s.bannerUrl ? [s.bannerUrl] : s.logoUrl ? [s.logoUrl] : undefined },
  };
}

export default async function SellerShop({ params }: Props) {
  const { slug } = await params;
  const { locale, t } = await getI18n();
  const ar = locale === "ar";
  const seller = await db.seller.findUnique({ where: { slug } });
  if (!seller || seller.status !== "APPROVED") notFound();
  const [products, reviews, user] = await Promise.all([
    db.product.findMany({ where: { ...visibleWhere, sellerId: seller.id }, include: productInclude, orderBy: { createdAt: "desc" } }),
    db.sellerReview.findMany({ where: { sellerId: seller.id, status: "PUBLISHED" }, orderBy: { createdAt: "desc" }, take: 20 }),
    getUser(),
  ]);
  const reviewers = await db.user.findMany({ where: { id: { in: reviews.map((r) => r.userId) } }, select: { id: true, name: true } });
  const canRate = user ? !!(await db.sellerOrder.findFirst({ where: { sellerId: seller.id, status: "DELIVERED", order: { OR: [{ userId: user.id }, { email: user.email }] } } })) : false;
  let social: Record<string, string> = {};
  try { social = JSON.parse(seller.social); } catch {}
  const onVacation = seller.vacationMode && (!seller.vacationUntil || seller.vacationUntil > new Date());
  const about = loc(locale, seller.about, seller.aboutAr);
  return (
    <div>
      <BreadcrumbJsonLd items={[{ name: t.common.home, url: "/" }, { name: ar ? "البائعون" : "Sellers", url: "/sellers" }, { name: seller.shopName, url: `/sellers/${slug}` }]} />
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "Store", name: seller.shopName, url: `${siteUrl()}/sellers/${slug}`, image: seller.logoUrl ? siteUrl() + seller.logoUrl : undefined,
        address: { "@type": "PostalAddress", addressRegion: seller.emirate, addressCountry: "AE" },
        ...(seller.ratingCount ? { aggregateRating: { "@type": "AggregateRating", ratingValue: seller.ratingAvg, reviewCount: seller.ratingCount } } : {}),
      }} />
      <div className="h-40 bg-gradient-to-r from-violet-800 to-brand-600 md:h-56" style={seller.bannerUrl ? { backgroundImage: `url(${seller.bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
      <div className="container-x">
        <div className="-mt-12 flex flex-wrap items-end gap-4">
          <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-3xl border-4 border-white bg-white text-4xl shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {seller.logoUrl ? <img src={seller.logoUrl} alt={seller.shopName} className="h-full w-full object-contain" /> : "🏪"}
          </div>
          <div className="pb-1">
            <h1 className="text-3xl font-black">{seller.shopName}</h1>
            <p className="text-sm text-slate-600">
              📍 {ar ? EMIRATES_AR[seller.emirate] ?? seller.emirate : seller.emirate} · {products.length} {ar ? "منتج" : "products"} ·{" "}
              {seller.ratingCount ? <span className="text-amber-500">★ {seller.ratingAvg} <span className="text-slate-500">({seller.ratingCount})</span></span> : ar ? "بائع جديد" : "New seller"} ·{" "}
              {ar ? "عضو منذ" : "Selling since"} {seller.createdAt.toLocaleDateString(ar ? "ar-AE" : "en-AE", { month: "short", year: "numeric" })}
            </p>
          </div>
          <span className="mb-1 ms-auto rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">✓ {ar ? "بائع موثّق" : "Verified seller"}</span>
        </div>
        {onVacation && <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">🏖️ {seller.vacationMessage || (ar ? "هذا المتجر في إجازة حاليًا ولا يقبل الطلبات." : "This shop is on vacation and isn't accepting orders right now.")}{seller.vacationUntil && ` (${ar ? "حتى" : "until"} ${seller.vacationUntil.toLocaleDateString(ar ? "ar-AE" : "en-AE")})`}</p>}
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
          <div>
            <h2 className="h-section">{ar ? "منتجات المتجر" : "Products"}</h2>
            <div className="mt-5"><ProductGrid products={products} /></div>
          </div>
          <aside className="space-y-5">
            {about && <div className="card p-5"><h3 className="font-bold">{ar ? "عن المتجر" : "About"}</h3><div className="prose-x mt-2 text-sm text-slate-700" dangerouslySetInnerHTML={{ __html: renderMarkdown(about) }} /></div>}
            {(seller.shippingPolicy || seller.returnPolicy) && (
              <div className="card space-y-3 p-5 text-sm">
                {seller.shippingPolicy && <div><h3 className="font-bold">{ar ? "سياسة الشحن" : "Shipping policy"}</h3><p className="mt-1 whitespace-pre-wrap text-slate-700">{seller.shippingPolicy}</p></div>}
                {seller.returnPolicy && <div><h3 className="font-bold">{ar ? "سياسة الإرجاع" : "Return policy"}</h3><p className="mt-1 whitespace-pre-wrap text-slate-700">{seller.returnPolicy}</p></div>}
                <p className="text-xs text-slate-500">{ar ? "جميع الطلبات محمية بضمان تك ريفايف للإرجاع خلال 14 يومًا." : "All orders are covered by TechRevive's 14-day return guarantee."}</p>
              </div>
            )}
            {Object.keys(social).length > 0 && <div className="card flex flex-wrap gap-3 p-5 text-sm">{Object.entries(social).map(([k, v]) => <a key={k} href={v} target="_blank" rel="noopener noreferrer nofollow" className="capitalize text-brand-700 hover:underline">{k}</a>)}</div>}
          </aside>
        </div>
        <div className="mt-14 grid gap-8 lg:grid-cols-2">
          <section>
            <h2 className="h-section">{ar ? "تقييمات البائع" : "Seller reviews"}</h2>
            <div className="mt-4 space-y-3">
              {reviews.map((r) => <div key={r.id} className="card p-4"><p className="flex justify-between"><b>{reviewers.find((u) => u.id === r.userId)?.name ?? "Customer"}</b><span className="text-amber-400">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span></p><p className="mt-1 text-sm text-slate-700">{r.comment}</p></div>)}
              {!reviews.length && <p className="text-sm text-slate-500">{ar ? "لا توجد تقييمات بعد." : "No reviews yet."}</p>}
              {canRate && <RateSellerForm sellerId={seller.id} />}
            </div>
          </section>
          <section id="contact">
            <h2 className="h-section">{ar ? "تواصل مع البائع" : "Contact seller"}</h2>
            <div className="card mt-4 p-5"><ContactSellerForm sellerId={seller.id} name={user?.name} email={user?.email} /></div>
          </section>
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { listedProducts, productInclude, visibleWhere } from "@/lib/catalog";
import { effectiveCondition, offerAvailable, offerListed, parsePhotos, schemaItemCondition } from "@/lib/offers";
import { getI18n, fmt } from "@/lib/i18n";
import { getSettings, pricingConfig } from "@/lib/settings";
import { loc, parseSpecs, parseValues } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";
import { siteUrl } from "@/lib/site";
import { toggleWishlist } from "@/app/actions/account";
import BuyBox from "@/components/BuyBox";
import Gallery from "@/components/Gallery";
import ReviewForm from "@/components/ReviewForm";
import Questions from "@/components/Questions";
import RecentlyViewed from "@/components/RecentlyViewed";
import { ProductGrid } from "@/components/ProductCard";
import { CompareToggle } from "@/components/Compare";
import { JsonLd, BreadcrumbJsonLd } from "@/components/JsonLd";
import { BoltIcon, HeartIcon, StarIcon } from "@/components/Icons";

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  return db.product.findFirst({
    where: { slug, ...visibleWhere },
    include: {
      variants: { orderBy: { position: "asc" }, include: { seller: true } }, options: { orderBy: { position: "asc" } }, images: { orderBy: { position: "asc" } }, category: true,
      seller: true, reviews: { where: { status: "PUBLISHED" }, include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await getI18n();
  const p = await load((await params).slug);
  if (!p) return {};
  const name = loc(locale, p.name, p.nameAr);
  const desc = p.seoDescription || loc(locale, p.description, p.descriptionAr).replace(/[#*_]/g, "").slice(0, 160);
  return {
    title: p.seoTitle || `${p.brand} ${name}`,
    description: desc,
    alternates: { canonical: `/products/${p.slug}` },
    openGraph: { type: "website", title: `${p.brand} ${name}`, description: desc, images: p.images.map((i) => i.url) },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await load(slug);
  if (!product) notFound();
  // only offers that may be shown (approved, seller approved & not on vacation); sold-out ones stay visible as "sold out"
  const offers = product.variants.filter(offerListed);
  if (!offers.length) notFound();
  const [{ t, locale }, user, s] = await Promise.all([getI18n(), getUser(), getSettings()]);
  const wished = user ? !!(await db.wishlistItem.findUnique({ where: { userId_productId: { userId: user.id, productId: product.id } } })) : false;
  const weekAgo = new Date(Date.now() - 7 * 86400_000);
  const [related, soldThisWeek, questions] = await Promise.all([
    db.product.findMany({ where: { ...visibleWhere, categoryId: product.categoryId, id: { not: product.id } }, include: productInclude, take: 8 }).then((r) => listedProducts(r).slice(0, 4)),
    db.orderItem.aggregate({ where: { productId: product.id, order: { createdAt: { gte: weekAgo }, status: { notIn: ["CANCELLED", "DRAFT"] } } }, _sum: { quantity: true } }),
    db.productQuestion.findMany({ where: { productId: product.id, published: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const name = loc(locale, product.name, product.nameAr);
  const specs = parseSpecs(product.specs);
  const avg = product.reviews.length ? product.reviews.reduce((a, r) => a + r.rating, 0) / product.reviews.length : 0;
  const options = product.options.map((o) => ({ name: o.name, nameAr: o.nameAr, values: parseValues(o.values) }));
  const images = product.images.length ? product.images.map((i) => ({ url: i.url, alt: i.alt || name })) : [{ url: product.image || "/img/gpu.svg", alt: name }];
  const minPrice = Math.min(...offers.map((v) => v.price));
  const ci = product.options.findIndex((o) => o.name.toLowerCase() === "condition");
  const condOf = (v: (typeof offers)[number]) => (ci >= 0 ? v[(["option1", "option2", "option3"] as const)[ci]] : null);
  const sellerIds = [...new Set(offers.map((v) => v.sellerId ?? "store"))];
  const onlySeller = sellerIds.length === 1 ? offers[0].seller : undefined;
  const sold = soldThisWeek._sum.quantity ?? 0;
  const catName = loc(locale, product.category.name, product.category.nameAr);

  return (
    <div className="container-x py-8">
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "Product", name: `${product.brand} ${product.name}`, description: product.description.replace(/[#*_]/g, ""),
        image: images.map((i) => (i.url.startsWith("http") ? i.url : siteUrl() + i.url)), brand: { "@type": "Brand", name: product.brand }, category: product.category.name,
        sku: offers[0]?.sku ?? undefined,
        offers: offers.map((v) => ({
          "@type": "Offer", url: `${siteUrl()}/products/${product.slug}`, priceCurrency: "AED", price: v.price, sku: v.sku ?? undefined, name: v.title,
          availability: offerAvailable(v) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          itemCondition: effectiveCondition(v, condOf(v)).type ? schemaItemCondition(effectiveCondition(v, condOf(v)).type) : "https://schema.org/NewCondition",
          seller: { "@type": "Organization", name: v.seller?.shopName ?? s.storeName },
          ...(v.warrantyMonths ? { warranty: { "@type": "WarrantyPromise", durationOfWarranty: { "@type": "QuantitativeValue", value: v.warrantyMonths, unitCode: "MON" } } } : {}),
          hasMerchantReturnPolicy: { "@type": "MerchantReturnPolicy", applicableCountry: "AE", returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow", merchantReturnDays: v.returnDays ?? s.returnsDays },
          shippingDetails: { "@type": "OfferShippingDetails", shippingDestination: { "@type": "DefinedRegion", addressCountry: "AE" } },
        })),
        ...(product.reviews.length ? {
          aggregateRating: { "@type": "AggregateRating", ratingValue: avg.toFixed(1), reviewCount: product.reviews.length },
          review: product.reviews.slice(0, 5).map((r) => ({ "@type": "Review", reviewRating: { "@type": "Rating", ratingValue: r.rating }, author: { "@type": "Person", name: r.user.name }, reviewBody: r.comment })),
        } : {}),
      }} />
      <BreadcrumbJsonLd items={[{ name: t.common.home, url: "/" }, { name: catName, url: `/category/${product.category.slug}` }, { name, url: `/products/${slug}` }]} />

      <nav className="text-sm text-slate-500" aria-label="Breadcrumb">
        <Link href="/" className="hover:underline">{t.common.home}</Link> / <Link href={`/category/${product.category.slug}`} className="hover:underline">{catName}</Link> / <span className="text-slate-800">{name}</span>
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div className="relative">
          <Gallery images={images} />
          {product.express && <span className="absolute start-4 top-4 flex items-center gap-1 rounded-full bg-ink-900 px-3 py-1.5 text-xs font-bold text-white"><BoltIcon className="h-3.5 w-3.5" /> {t.header.express.replace("⚡ ", "")}</span>}
        </div>
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{product.brand}</p>
              <h1 className="mt-1 text-2xl font-black leading-tight md:text-3xl">{name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                {product.reviews.length > 0 && <a href="#reviews" className="flex items-center gap-1 text-amber-500"><StarIcon filled /> <span className="text-slate-700">{avg.toFixed(1)} · {fmt(t.product.reviewCount, { n: product.reviews.length })}</span></a>}
                {sold >= 2 && <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-orange-700">🔥 {locale === "ar" ? `بيع ${sold} هذا الأسبوع` : `${sold} sold this week`}</span>}
              </div>
              <p className="mt-2 text-sm text-slate-600">
                {sellerIds.length > 1
                  ? <b>{locale === "ar" ? `${sellerIds.length} بائعين يعرضون هذا المنتج` : `${sellerIds.length} sellers offer this product`}</b>
                  : <>
                      {locale === "ar" ? "يُباع بواسطة " : "Sold by "}
                      {onlySeller ? <Link href={`/sellers/${onlySeller.slug}`} className="font-semibold text-brand-700 hover:underline">{onlySeller.shopName}</Link> : <b>{loc(locale, s.storeName, s.storeNameAr)}</b>}
                      {onlySeller && onlySeller.ratingCount > 0 && <span className="text-slate-500"> · ★ {onlySeller.ratingAvg.toFixed(1)}</span>}
                    </>}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <form action={toggleWishlist}>
                <input type="hidden" name="productId" value={product.id} />
                <input type="hidden" name="path" value={`/products/${slug}`} />
                <button className={`rounded-full border p-3 ${wished ? "border-red-200 bg-red-50 text-accent" : "border-slate-200 hover:bg-slate-100"}`} title={t.common.wishlist} aria-label={t.common.wishlist} aria-pressed={wished}>
                  <HeartIcon className={`h-5 w-5 ${wished ? "fill-current" : ""}`} />
                </button>
              </form>
            </div>
          </div>
          <div className="card mt-6 p-5">
            <BuyBox
              variants={offers.map((v) => ({
                id: v.id, title: v.title, option1: v.option1, option2: v.option2, option3: v.option3, price: v.price, comparePrice: v.comparePrice, stock: v.stock,
                trackInventory: v.trackInventory, continueSelling: v.continueSelling, sku: v.sku, image: v.image, sellerId: v.sellerId,
                // only public seller fields are sent to the browser
                seller: v.seller ? { id: v.seller.id, shopName: v.seller.shopName, slug: v.seller.slug, status: v.seller.status, vacationMode: v.seller.vacationMode, ratingAvg: v.seller.ratingAvg, ratingCount: v.seller.ratingCount } : null,
                conditionType: v.conditionType, cosmeticGrade: v.cosmeticGrade, functionalStatus: v.functionalStatus, batteryHealth: v.batteryHealth, batteryCycles: v.batteryCycles,
                repairDisclosure: v.repairDisclosure, accessories: v.accessories, verification: v.verification, testedAt: v.testedAt ? v.testedAt.toISOString() : null,
                testedBy: v.testedBy, testNotes: v.testNotes, photos: parsePhotos(v), warrantyProvider: v.warrantyProvider, warrantyMonths: v.warrantyMonths,
                warrantyTerms: v.warrantyTerms, returnDays: v.returnDays, returnTerms: v.returnTerms, handlingDays: v.handlingDays,
              }))}
              options={options} priceNew={product.priceNew} express={product.express} name={name} cfg={pricingConfig(s)} codEnabled={s.checkout.codEnabled} onImage={images[0].url}
              defaults={{ warrantyMonths: s.warranty.months, returnDays: s.returnsDays, storeName: s.storeName, storeNameAr: s.storeNameAr }}
              batteryRelevant={product.category.slug === "laptops" || offers.some((v) => v.batteryHealth != null)}
            />
          </div>
          <div className="mt-3"><CompareToggle slug={product.slug} /></div>
        </div>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-xl font-bold">{t.product.description}</h2>
          <div className="prose-x mt-3 text-slate-700" dangerouslySetInnerHTML={{ __html: renderMarkdown(loc(locale, product.description, product.descriptionAr)) }} />
          {Object.keys(specs).length > 0 && (
            <>
              <h2 className="mt-8 text-xl font-bold">{t.product.specifications}</h2>
              <table className="card mt-3 w-full overflow-hidden text-sm" dir="ltr">
                <tbody>
                  {Object.entries(specs).map(([k, v], i) => (
                    <tr key={k} className={i % 2 ? "bg-slate-50" : ""}><td className="w-1/3 px-4 py-2.5 font-medium text-slate-600">{k}</td><td className="px-4 py-2.5">{v}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          <Questions productId={product.id} questions={questions.map((q) => ({ id: q.id, name: q.name, question: q.question, answer: q.answer }))} />
        </section>
        <section id="reviews">
          <h2 className="text-xl font-bold">{t.product.reviews}</h2>
          <div className="mt-3 space-y-3">
            {product.reviews.length === 0 && <p className="text-sm text-slate-500">{t.product.noReviews}</p>}
            {product.reviews.map((r) => (
              <div key={r.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{r.user.name}{r.verified && <span className="ms-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">✓ {locale === "ar" ? "مشتري موثّق" : "Verified purchase"}</span>}</p>
                  <span className="flex text-amber-400" aria-label={`${r.rating}/5`}>{[1, 2, 3, 4, 5].map((i) => <StarIcon key={i} filled={i <= r.rating} />)}</span>
                </div>
                <p className="mt-2 text-sm text-slate-700">{r.comment}</p>
                {r.reply && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm"><b>{t.product.storeReply}:</b> {r.reply}</p>}
              </div>
            ))}
            {user ? <ReviewForm productId={product.id} /> : <p className="text-sm"><Link href={`/login?next=/products/${slug}`} className="font-semibold text-brand-700 underline">{t.product.loginToReview}</Link></p>}
          </div>
        </section>
      </div>

      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="h-section">{t.product.youMayLike}</h2>
          <div className="mt-6"><ProductGrid products={related} /></div>
        </section>
      )}
      <RecentlyViewed current={{ slug: product.slug, name: product.name, nameAr: product.nameAr, image: images[0].url, price: minPrice }} />
      <div className="h-16" />
    </div>
  );
}

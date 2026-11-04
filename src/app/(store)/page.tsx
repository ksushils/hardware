import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { productInclude, searchProducts, visibleWhere } from "@/lib/catalog";
import { getCollectionProducts } from "@/lib/collections";
import { getI18n } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { loc } from "@/lib/format";
import { ProductGrid } from "@/components/ProductCard";
import TrustBar from "@/components/TrustBar";
import HeroVideo from "@/components/HeroVideo";
import RecentlyViewed from "@/components/RecentlyViewed";
import { BoltIcon, CheckIcon, StarIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [{ t, locale }, s] = await Promise.all([getI18n(), getSettings()]);
  const [categories, featured, deals, gpus, homeCollections, posts] = await Promise.all([
    db.category.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { products: { where: visibleWhere } } } } }),
    searchProducts({ featured: true }),
    searchProducts({ sort: "discount", inStock: true }),
    db.product.findMany({ where: { ...visibleWhere, category: { slug: "graphics-cards" } }, include: productInclude, take: 4 }),
    db.collection.findMany({ where: { published: true, showOnHome: true }, take: 3 }),
    db.article.findMany({ where: { published: true, publishedAt: { lte: new Date() } }, orderBy: { publishedAt: "desc" }, take: 3 }),
  ]);
  const collections = await Promise.all(homeCollections.map(async (c) => ({ c, products: (await getCollectionProducts(c)).slice(0, 4) })));
  const h = s.hero;
  const arrow = locale === "ar" ? "←" : "→";

  return (
    <>
      <section className="relative isolate overflow-hidden bg-ink-900 text-white">
        <HeroVideo src={h.videoUrl} poster={h.posterUrl} overlay={h.overlayOpacity} />
        <div className="container-x relative grid items-center gap-10 py-16 md:grid-cols-2 md:py-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur">
              <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" /> {t.home.badge}
            </span>
            <h1 className="mt-5 text-4xl font-black leading-tight tracking-tight md:text-6xl">
              {loc(locale, h.title, h.titleAr)}<br /><span className="text-brand-500">{loc(locale, h.highlight, h.highlightAr)}</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-slate-300">{loc(locale, h.subtitle, h.subtitleAr)}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/deals" className="btn bg-brand-600 text-white hover:bg-brand-500">{t.home.shopDeals}</Link>
              <Link href="/build" className="btn bg-white text-ink-900 hover:bg-slate-100">🛠️ {locale === "ar" ? "جمّع جهازك" : "Build your PC"}</Link>
              <Link href="/category/graphics-cards" className="btn bg-white/10 text-white backdrop-blur hover:bg-white/20">{t.home.browseGpus}</Link>
            </div>
            <div className="mt-8 flex items-center gap-2 text-sm text-slate-300">
              <span className="flex text-amber-400">{[1, 2, 3, 4, 5].map((i) => <StarIcon key={i} filled />)}</span>{t.home.trusted}
            </div>
          </div>
        </div>
      </section>

      <div className="container-x relative z-10 -mt-8"><TrustBar /></div>

      <section className="container-x mt-14">
        <div className="flex items-end justify-between">
          <h2 className="h-section">{t.home.shopByCategory}</h2>
          <Link href="/search" className="text-sm font-semibold text-brand-700 hover:underline">{t.common.allProducts} {arrow}</Link>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {categories.map((c) => (
            <Link key={c.id} href={`/category/${c.slug}`} className="card group flex flex-col items-center p-3 text-center transition hover:border-brand-500 hover:shadow">
              <div className="relative aspect-square w-full"><Image src={`/img/${c.icon}.svg`} alt="" fill className="rounded-xl object-cover" unoptimized /></div>
              <p className="mt-2 text-xs font-semibold leading-tight md:text-sm">{loc(locale, c.name, c.nameAr)}</p>
              <p className="text-[11px] text-slate-500">{c._count.products} {t.common.products}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="container-x mt-16">
        <div className="flex items-end justify-between">
          <h2 className="h-section">{t.home.bestSellers}</h2>
          <Link href="/search?sort=featured" className="text-sm font-semibold text-brand-700 hover:underline">{t.common.seeAll} {arrow}</Link>
        </div>
        <div className="mt-6"><ProductGrid products={featured.slice(0, 8)} /></div>
      </section>

      <section className="container-x mt-16">
        <div className="card flex flex-col items-center justify-between gap-6 overflow-hidden bg-gradient-to-r from-amber-400 to-orange-500 p-8 text-ink-900 md:flex-row md:p-12 rtl:bg-gradient-to-l">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold uppercase"><BoltIcon /> {t.home.expressKicker}</p>
            <h3 className="mt-2 text-3xl font-black">{t.home.expressTitle}</h3>
            <p className="mt-2 max-w-xl">{t.home.expressText}</p>
          </div>
          <Link href="/express" className="btn-dark shrink-0">{t.home.shopExpress}</Link>
        </div>
      </section>

      <section className="container-x mt-16">
        <div className="flex items-end justify-between">
          <h2 className="h-section">{t.home.biggestSavings}</h2>
          <Link href="/deals" className="text-sm font-semibold text-brand-700 hover:underline">{t.common.seeAll} {arrow}</Link>
        </div>
        <div className="mt-6"><ProductGrid products={deals.slice(0, 4)} /></div>
      </section>

      {collections.filter((x) => x.products.length).map(({ c, products }) => (
        <section key={c.id} className="container-x mt-16">
          <div className="flex items-end justify-between">
            <div><h2 className="h-section">{loc(locale, c.title, c.titleAr)}</h2><p className="text-sm text-slate-500">{loc(locale, c.description, c.descriptionAr)}</p></div>
            <Link href={`/collections/${c.handle}`} className="text-sm font-semibold text-brand-700 hover:underline">{t.common.seeAll} {arrow}</Link>
          </div>
          <div className="mt-6"><ProductGrid products={products} /></div>
        </section>
      ))}

      <section className="container-x mt-16">
        <div className="grid gap-6 md:grid-cols-2">
          <Link href="/build" className="card group flex flex-col justify-between bg-ink-900 p-8 text-white">
            <div>
              <p className="text-sm font-bold uppercase text-brand-500">🛠️ {locale === "ar" ? "أداة التجميع" : "PC Builder"}</p>
              <h3 className="mt-2 text-2xl font-black">{locale === "ar" ? "جمّع جهازك مع فحص التوافق التلقائي" : "Build your PC with automatic compatibility checks"}</h3>
              <p className="mt-2 text-slate-300">{locale === "ar" ? "المقبس، نوع الذاكرة، القدرة الكهربائية — نتحقق من كل شيء." : "Socket, memory type, wattage: we check it all as you pick parts."}</p>
            </div>
            <span className="mt-6 font-semibold text-brand-500 group-hover:underline">{locale === "ar" ? "ابدأ التجميع" : "Start building"} {arrow}</span>
          </Link>
          <Link href="/trade-in" className="card group flex flex-col justify-between bg-brand-50 p-8">
            <div>
              <p className="text-sm font-bold uppercase text-brand-700">♻️ {locale === "ar" ? "الاستبدال" : "Trade-in"}</p>
              <h3 className="mt-2 text-2xl font-black">{locale === "ar" ? "اعرف قيمة قطعتك القديمة فورًا" : "Get an instant value for your old hardware"}</h3>
              <p className="mt-2 text-slate-600">{locale === "ar" ? "احصل على رصيد شراء أعلى بـ 10% عند الاستبدال." : "Get 10% extra as store credit when you trade in."}</p>
            </div>
            <span className="mt-6 font-semibold text-brand-700 group-hover:underline">{locale === "ar" ? "احسب القيمة" : "Estimate now"} {arrow}</span>
          </Link>
        </div>
      </section>

      <section className="container-x mt-16">
        <div className="flex items-end justify-between">
          <h2 className="h-section">{t.home.graphicsCards}</h2>
          <Link href="/category/graphics-cards" className="text-sm font-semibold text-brand-700 hover:underline">{t.common.seeAll} {arrow}</Link>
        </div>
        <div className="mt-6"><ProductGrid products={gpus} /></div>
      </section>

      <section className="container-x mt-16">
        <div className="card grid gap-10 p-8 md:grid-cols-2 md:p-12">
          <div>
            <h2 className="h-section">{t.home.whatIs}</h2>
            <p className="mt-4 text-slate-600">{t.home.whatIsText}</p>
            <Link href="/pages/about" className="btn-outline mt-6">{t.home.howWeGrade}</Link>
          </div>
          <ul className="space-y-4">
            {t.home.promises.map(([title, d]) => (
              <li key={title} className="flex gap-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-600 text-white"><CheckIcon className="h-4 w-4" /></span>
                <div><p className="font-semibold">{title}</p><p className="text-sm text-slate-600">{d}</p></div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {posts.length > 0 && (
        <section className="container-x mt-16">
          <div className="flex items-end justify-between">
            <h2 className="h-section">{t.home.fromBlog}</h2>
            <Link href="/blog" className="text-sm font-semibold text-brand-700 hover:underline">{t.common.seeAll} {arrow}</Link>
          </div>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {posts.map((p) => (
              <Link key={p.id} href={`/blog/${p.handle}`} className="card group overflow-hidden transition hover:shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.image && <img src={p.image} alt="" className="aspect-[16/9] w-full bg-slate-100 object-cover" loading="lazy" />}
                <div className="p-5">
                  <p className="text-xs text-slate-500">{p.publishedAt.toLocaleDateString(locale === "ar" ? "ar-AE" : "en-AE", { dateStyle: "medium" })}</p>
                  <h3 className="mt-1 font-bold group-hover:text-brand-700">{loc(locale, p.title, p.titleAr)}</h3>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600">{loc(locale, p.excerpt, p.excerptAr)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="container-x"><RecentlyViewed /></div>
    </>
  );
}

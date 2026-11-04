import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n";
import { loc } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.blog.title, description: t.blog.subtitle, alternates: { canonical: "/blog", types: { "application/rss+xml": "/blog/rss.xml" } } };
}

export default async function BlogIndex({ searchParams }: { searchParams: Promise<{ tag?: string }> }) {
  const { tag } = await searchParams;
  const { t, locale } = await getI18n();
  const posts = await db.article.findMany({ where: { published: true, publishedAt: { lte: new Date() }, ...(tag ? { tags: { contains: tag } } : {}) }, orderBy: { publishedAt: "desc" } });
  const [first, ...rest] = posts;
  return (
    <div className="container-x py-10">
      <h1 className="text-4xl font-black tracking-tight">{t.blog.title}</h1>
      <p className="mt-2 text-slate-600">{t.blog.subtitle}</p>
      {first && (
        <Link href={`/blog/${first.handle}`} className="card group mt-8 grid overflow-hidden md:grid-cols-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {first.image && <img src={first.image} alt="" className="aspect-[16/10] h-full w-full bg-slate-100 object-cover" />}
          <div className="flex flex-col justify-center p-8">
            <p className="text-xs text-slate-500">{first.publishedAt.toLocaleDateString(locale === "ar" ? "ar-AE" : "en-AE", { dateStyle: "long" })}</p>
            <h2 className="mt-2 text-2xl font-black group-hover:text-brand-700">{loc(locale, first.title, first.titleAr)}</h2>
            <p className="mt-3 text-slate-600">{loc(locale, first.excerpt, first.excerptAr)}</p>
            <span className="mt-4 font-semibold text-brand-700">{t.common.readMore} →</span>
          </div>
        </Link>
      )}
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {rest.map((p) => (
          <Link key={p.id} href={`/blog/${p.handle}`} className="card group overflow-hidden transition hover:shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {p.image && <img src={p.image} alt="" className="aspect-[16/9] w-full bg-slate-100 object-cover" loading="lazy" />}
            <div className="p-5">
              <p className="text-xs text-slate-500">{p.publishedAt.toLocaleDateString(locale === "ar" ? "ar-AE" : "en-AE", { dateStyle: "medium" })}</p>
              <h2 className="mt-1 font-bold group-hover:text-brand-700">{loc(locale, p.title, p.titleAr)}</h2>
              <p className="mt-2 line-clamp-3 text-sm text-slate-600">{loc(locale, p.excerpt, p.excerptAr)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

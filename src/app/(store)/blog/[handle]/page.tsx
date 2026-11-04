import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getI18n, fmt } from "@/lib/i18n";
import { loc } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";
import { siteUrl } from "@/lib/site";
import { getSettings } from "@/lib/settings";
import { JsonLd, BreadcrumbJsonLd } from "@/components/JsonLd";

type Props = { params: Promise<{ handle: string }> };
const load = (handle: string) => db.article.findFirst({ where: { handle, published: true, publishedAt: { lte: new Date() } } });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await getI18n();
  const a = await load((await params).handle);
  if (!a) return {};
  return {
    title: loc(locale, a.title, a.titleAr), description: loc(locale, a.excerpt, a.excerptAr), alternates: { canonical: `/blog/${a.handle}` },
    openGraph: { type: "article", publishedTime: a.publishedAt.toISOString(), authors: [a.author], images: a.image ? [a.image] : undefined },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { handle } = await params;
  const [{ t, locale }, s] = await Promise.all([getI18n(), getSettings()]);
  const a = await load(handle);
  if (!a) notFound();
  const body = loc(locale, a.body, a.bodyAr);
  const minutes = Math.max(1, Math.round(body.split(/\s+/).length / 200));
  const more = await db.article.findMany({ where: { published: true, id: { not: a.id }, publishedAt: { lte: new Date() } }, orderBy: { publishedAt: "desc" }, take: 3 });
  const title = loc(locale, a.title, a.titleAr);
  return (
    <article className="container-x max-w-3xl py-10">
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "BlogPosting", headline: title, description: loc(locale, a.excerpt, a.excerptAr), datePublished: a.publishedAt.toISOString(), dateModified: a.updatedAt.toISOString(),
        author: { "@type": "Organization", name: a.author }, publisher: { "@type": "Organization", name: s.storeName, logo: { "@type": "ImageObject", url: `${siteUrl()}/favicon.svg` } },
        image: a.image ? (a.image.startsWith("http") ? a.image : siteUrl() + a.image) : undefined, mainEntityOfPage: `${siteUrl()}/blog/${a.handle}`, inLanguage: locale === "ar" ? "ar-AE" : "en-AE",
      }} />
      <BreadcrumbJsonLd items={[{ name: t.common.home, url: "/" }, { name: t.blog.title, url: "/blog" }, { name: title, url: `/blog/${a.handle}` }]} />
      <Link href="/blog" className="text-sm font-semibold text-brand-700">{t.blog.back}</Link>
      <h1 className="mt-4 text-3xl font-black leading-tight md:text-5xl">{title}</h1>
      <p className="mt-3 text-sm text-slate-500">{fmt(t.blog.by, { author: a.author })} · {a.publishedAt.toLocaleDateString(locale === "ar" ? "ar-AE" : "en-AE", { dateStyle: "long" })} · {fmt(t.blog.minRead, { n: minutes })}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {a.image && <img src={a.image} alt="" className="mt-6 aspect-[16/9] w-full rounded-2xl bg-slate-100 object-cover" />}
      <div className="prose-x mt-8 text-lg text-slate-700" dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }} />
      {more.length > 0 && (
        <section className="mt-14 border-t pt-8">
          <h2 className="text-xl font-bold">{t.blog.related}</h2>
          <ul className="mt-4 space-y-3">{more.map((m) => <li key={m.id}><Link href={`/blog/${m.handle}`} className="font-semibold text-brand-700 hover:underline">{loc(locale, m.title, m.titleAr)}</Link></li>)}</ul>
        </section>
      )}
    </article>
  );
}

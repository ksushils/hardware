import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n";
import { loc } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";

type Props = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await getI18n();
  const p = await db.page.findUnique({ where: { handle: (await params).handle } });
  if (!p || !p.published) return {};
  return { title: p.seoTitle || loc(locale, p.title, p.titleAr), description: p.seoDescription ?? undefined, alternates: { canonical: `/pages/${p.handle}` } };
}

export default async function CmsPage({ params }: Props) {
  const { locale } = await getI18n();
  const p = await db.page.findUnique({ where: { handle: (await params).handle } });
  if (!p || !p.published) notFound();
  return (
    <article className="container-x max-w-3xl py-12">
      <h1 className="text-4xl font-black tracking-tight">{loc(locale, p.title, p.titleAr)}</h1>
      <div className="prose-x mt-6 text-slate-700" dangerouslySetInnerHTML={{ __html: renderMarkdown(loc(locale, p.body, p.bodyAr)) }} />
    </article>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n";
import { loc } from "@/lib/format";
import Listing from "@/components/Listing";
import { BreadcrumbJsonLd } from "@/components/JsonLd";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[]>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await getI18n();
  const c = await db.category.findUnique({ where: { slug: (await params).slug } });
  if (!c) return {};
  const name = loc(locale, c.name, c.nameAr);
  return {
    title: locale === "ar" ? `${name} — مُجدد وجديد` : `${name}: Renewed & New in UAE`,
    description: loc(locale, c.description, c.descriptionAr),
    alternates: { canonical: `/category/${c.slug}` },
    openGraph: { images: [`/img/${c.icon}.svg`] },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { locale, t } = await getI18n();
  const category = await db.category.findUnique({ where: { slug } });
  if (!category) notFound();
  const name = loc(locale, category.name, category.nameAr);
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: t.common.home, url: "/" }, { name, url: `/category/${slug}` }]} />
      <Listing title={name} subtitle={loc(locale, category.description, category.descriptionAr)} searchParams={await searchParams} base={{ category: slug }} />
    </>
  );
}

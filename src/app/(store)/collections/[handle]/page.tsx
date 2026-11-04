import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n";
import { loc } from "@/lib/format";
import { getCollectionProducts } from "@/lib/collections";
import Listing from "@/components/Listing";
import { BreadcrumbJsonLd } from "@/components/JsonLd";

type Props = { params: Promise<{ handle: string }>; searchParams: Promise<Record<string, string | string[]>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await getI18n();
  const c = await db.collection.findUnique({ where: { handle: (await params).handle } });
  if (!c) return {};
  return { title: c.seoTitle || loc(locale, c.title, c.titleAr), description: c.seoDescription || loc(locale, c.description, c.descriptionAr), alternates: { canonical: `/collections/${c.handle}` } };
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { handle } = await params;
  const { locale, t } = await getI18n();
  const c = await db.collection.findUnique({ where: { handle } });
  if (!c || !c.published) notFound();
  const ids = (await getCollectionProducts(c)).map((p) => p.id);
  const title = loc(locale, c.title, c.titleAr);
  const sp = await searchParams;
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: t.common.home, url: "/" }, { name: t.collections.title, url: "/collections" }, { name: title, url: `/collections/${handle}` }]} />
      <Listing title={title} subtitle={loc(locale, c.description, c.descriptionAr)} searchParams={sp} base={{ ids, sort: typeof sp.sort === "string" ? sp.sort : undefined }} />
    </>
  );
}

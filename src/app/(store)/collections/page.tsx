import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n";
import { loc } from "@/lib/format";
import { getCollectionProducts } from "@/lib/collections";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.collections.title, alternates: { canonical: "/collections" } };
}

export default async function CollectionsPage() {
  const { t, locale } = await getI18n();
  const collections = await db.collection.findMany({ where: { published: true }, orderBy: { createdAt: "asc" } });
  const withProducts = await Promise.all(collections.map(async (c) => ({ c, products: (await getCollectionProducts(c)).slice(0, 4) })));
  return (
    <div className="container-x py-8">
      <h1 className="text-3xl font-black">{t.collections.title}</h1>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {withProducts.map(({ c, products }) => (
          <Link key={c.id} href={`/collections/${c.handle}`} className="card group overflow-hidden transition hover:shadow-lg">
            <div className="grid grid-cols-4 gap-1 bg-slate-50 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {c.image ? <img src={c.image} alt="" className="col-span-4 h-32 w-full object-cover" /> : products.map((p) => <img key={p.id} src={p.image} alt="" className="aspect-square w-full object-contain" />)}
            </div>
            <div className="p-4">
              <p className="text-lg font-bold group-hover:text-brand-700">{loc(locale, c.title, c.titleAr)}</p>
              <p className="text-sm text-slate-500">{loc(locale, c.description, c.descriptionAr)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

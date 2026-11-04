import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { productInclude, bestVariant, rating, availableConditions, visibleWhere, listedProducts } from "@/lib/catalog";
import { getI18n } from "@/lib/i18n";
import { aed, loc, parseSpecs, pctOff } from "@/lib/format";
import { CompareRemove } from "@/components/Compare";

export const metadata: Metadata = { title: "Compare products", robots: { index: false } };

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const { t, locale } = await getI18n();
  const ar = locale === "ar";
  const slugs = (p ?? "").split(",").filter(Boolean).slice(0, 4);
  const products = slugs.length ? listedProducts(await db.product.findMany({ where: { ...visibleWhere, slug: { in: slugs } }, include: productInclude })) : [];
  const ordered = slugs.map((s) => products.find((x) => x.slug === s)).filter((x): x is NonNullable<typeof x> => !!x);
  if (!ordered.length)
    return <div className="container-x py-20 text-center"><h1 className="text-3xl font-black">{ar ? "مقارنة المنتجات" : "Compare products"}</h1><p className="mt-2 text-slate-600">{ar ? "اضغط \"قارن\" على أي منتج لإضافته (حتى 4)." : "Tap “Compare” on any product to add it (up to 4)."}</p><Link href="/search" className="btn-primary mt-6">{t.common.allProducts}</Link></div>;
  const specs = ordered.map((x) => parseSpecs(x.specs));
  const keys = [...new Set(specs.flatMap((s) => Object.keys(s)))];
  const differs = (vals: string[]) => new Set(vals).size > 1;
  const rows: [string, React.ReactNode[], boolean][] = [
    [ar ? "السعر من" : "Price from", ordered.map((x) => <b key={x.id}>{aed(bestVariant(x)?.price ?? 0, locale)}</b>), true],
    [ar ? "التوفير مقارنة بالجديد" : "Saving vs new", ordered.map((x) => { const o = pctOff(bestVariant(x)?.price ?? 0, x.priceNew); return <span key={x.id} className="font-semibold text-accent">{o ? `-${o}%` : "—"}</span>; }), true],
    [ar ? "الحالات المتوفرة" : "Conditions", ordered.map((x) => availableConditions(x).map((c) => t.values[c] ?? c).join(", ") || t.common.soldOut), true],
    [ar ? "التقييم" : "Rating", ordered.map((x) => { const r = rating(x); return r ? `★ ${r.avg.toFixed(1)} (${r.count})` : "—"; }), true],
    [ar ? "توصيل سريع" : "Express delivery", ordered.map((x) => (x.express ? "✓" : "—")), true],
    [ar ? "البائع" : "Sold by", ordered.map((x) => x.seller?.shopName ?? "TechRevive"), true],
    ...keys.map((k) => [k, specs.map((s) => s[k] ?? "—"), differs(specs.map((s) => s[k] ?? "—"))] as [string, React.ReactNode[], boolean]),
  ];
  return (
    <div className="container-x py-8">
      <h1 className="text-3xl font-black">{ar ? "مقارنة المنتجات" : "Compare products"}</h1>
      <p className="mt-1 text-sm text-slate-500">{ar ? "الصفوف المميزة تختلف بين المنتجات." : "Highlighted rows differ between products."}</p>
      <div className="card mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm" dir="ltr">
          <thead>
            <tr className="border-b">
              <th className="w-40 p-4" />
              {ordered.map((x) => (
                <th key={x.id} className="p-4 text-start align-top">
                  <div className="flex justify-end"><CompareRemove slug={x.slug} /></div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={x.image} alt="" className="mx-auto h-28 w-28 object-contain" />
                  <Link href={`/products/${x.slug}`} className="mt-2 block font-semibold hover:underline">{x.brand} {loc(locale, x.name, x.nameAr)}</Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, vals, diff]) => (
              <tr key={label} className={`border-b last:border-0 ${diff ? "bg-amber-50/50" : ""}`}>
                <td className="p-4 font-medium text-slate-500">{label}</td>
                {vals.map((v, i) => <td key={i} className="p-4">{v}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

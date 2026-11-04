import type { Metadata } from "next";
import { db } from "@/lib/db";
import { visibleWhere, listedVariantWhere } from "@/lib/catalog";
import { offerListed } from "@/lib/offers";
import { getI18n } from "@/lib/i18n";
import { parseSpecs } from "@/lib/format";
import { isAvailable } from "@/lib/inventory";
import Builder, { type BuilderProduct } from "./Builder";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  return {
    title: locale === "ar" ? "أداة تجميع الكمبيوتر مع فحص التوافق" : "PC Builder with Compatibility Check",
    description: "Build a custom gaming PC in the UAE from certified renewed and new parts. Automatic socket, RAM and wattage compatibility checks.",
    alternates: { canonical: "/build" },
  };
}

const SLOTS = [
  { key: "cpu", cat: "processors", required: true },
  { key: "motherboard", cat: "motherboards", required: true },
  { key: "ram", cat: "memory", required: true },
  { key: "gpu", cat: "graphics-cards", required: false },
  { key: "storage", cat: "storage", required: true },
  { key: "psu", cat: "power-supplies", required: true },
  { key: "case", cat: "cases", required: true },
  { key: "cooling", cat: "cooling", required: false },
] as const;

export default async function BuildPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const products = await db.product.findMany({
    where: { ...visibleWhere, category: { slug: { in: SLOTS.map((s) => s.cat) } } },
    include: { variants: { where: listedVariantWhere, orderBy: { price: "asc" }, include: { seller: true } }, category: true },
  });
  const data: BuilderProduct[] = products.map((p) => ({
    id: p.id, slug: p.slug, name: p.name, nameAr: p.nameAr, brand: p.brand, image: p.image, cat: p.category.slug, priceNew: p.priceNew, specs: parseSpecs(p.specs),
    variants: p.variants.filter((v) => offerListed(v) && isAvailable(v)).map((v) => ({ id: v.id, title: v.seller ? `${v.title} · ${v.seller.shopName}` : v.title, price: v.price })),
  })).filter((p) => p.variants.length);
  const initial: Record<string, string> = {};
  for (const s of SLOTS) if (sp[s.key]) initial[s.key] = sp[s.key];
  return <Builder products={data} slots={SLOTS.map((s) => ({ ...s }))} initial={initial} />;
}

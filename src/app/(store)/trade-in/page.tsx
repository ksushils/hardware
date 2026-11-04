import type { Metadata } from "next";
import { db } from "@/lib/db";
import { visibleWhere, bestVariant, productInclude } from "@/lib/catalog";
import { getI18n } from "@/lib/i18n";
import TradeInEstimator from "./TradeInEstimator";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  return { title: locale === "ar" ? "قيّم جهازك للاستبدال" : "Trade-in: Sell Your GPU, CPU or Laptop in UAE", description: "Get an instant estimate for your used graphics card, CPU, laptop or monitor. Free collection across the UAE, paid in 2 days or +10% store credit.", alternates: { canonical: "/trade-in" } };
}

const CATS = ["graphics-cards", "processors", "laptops", "monitors", "gaming-pcs", "memory", "storage", "motherboards", "peripherals"];

export default async function TradeInPage() {
  const products = await db.product.findMany({ where: { ...visibleWhere, category: { slug: { in: CATS } } }, include: productInclude });
  const models = products.map((p) => ({ id: p.id, cat: p.category.slug, catName: p.category.name, catNameAr: p.category.nameAr, name: `${p.brand} ${p.name}`, priceNew: p.priceNew, resale: bestVariant(p)?.price ?? p.priceNew * 0.6 }));
  return <TradeInEstimator models={models} />;
}

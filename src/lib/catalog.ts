import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";

export const productInclude = { variants: true, category: true, reviews: { select: { rating: true } } } satisfies Prisma.ProductInclude;
export type CatalogProduct = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

export function bestVariant(p: { variants: { price: number; stock: number }[] }) {
  const inStock = p.variants.filter((v) => v.stock > 0);
  const pool = inStock.length ? inStock : p.variants;
  return pool.reduce((a, b) => (b.price < a.price ? b : a), pool[0]);
}

export function rating(p: { reviews: { rating: number }[] }) {
  if (!p.reviews.length) return null;
  return { avg: p.reviews.reduce((s, r) => s + r.rating, 0) / p.reviews.length, count: p.reviews.length };
}

export type ProductQuery = {
  q?: string; category?: string; brand?: string[]; condition?: string[];
  min?: number; max?: number; sort?: string; express?: boolean; featured?: boolean; inStock?: boolean;
};

export async function searchProducts(query: ProductQuery) {
  const where: Prisma.ProductWhereInput = { active: true };
  if (query.category) where.category = { slug: query.category };
  if (query.brand?.length) where.brand = { in: query.brand };
  if (query.express) where.express = true;
  if (query.featured) where.featured = true;
  if (query.q) {
    const terms = query.q.trim().split(/\s+/).slice(0, 6);
    where.AND = terms.map((t) => ({ OR: [{ name: { contains: t } }, { brand: { contains: t } }, { description: { contains: t } }, { specs: { contains: t } }] }));
  }
  const variantWhere: Prisma.VariantWhereInput = {};
  if (query.condition?.length) variantWhere.condition = { in: query.condition };
  if (query.min != null || query.max != null) variantWhere.price = { gte: query.min ?? 0, lte: query.max ?? 1e9 };
  if (query.inStock) variantWhere.stock = { gt: 0 };
  if (Object.keys(variantWhere).length) where.variants = { some: variantWhere };

  let products = await db.product.findMany({ where, include: productInclude, orderBy: { createdAt: "desc" } });
  const price = (p: CatalogProduct) => bestVariant(p)?.price ?? 0;
  const off = (p: CatalogProduct) => 1 - price(p) / p.priceNew;
  switch (query.sort) {
    case "price-asc": products = products.sort((a, b) => price(a) - price(b)); break;
    case "price-desc": products = products.sort((a, b) => price(b) - price(a)); break;
    case "discount": products = products.sort((a, b) => off(b) - off(a)); break;
    case "name": products = products.sort((a, b) => a.name.localeCompare(b.name)); break;
    default: products = products.sort((a, b) => Number(b.featured) - Number(a.featured));
  }
  return products;
}

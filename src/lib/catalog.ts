import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { isAvailable } from "./inventory";
import { offerListed, type OfferLike } from "./offers";

const sellerSelect = { id: true, shopName: true, slug: true, status: true, vacationMode: true, vacationUntil: true, ratingAvg: true, ratingCount: true } as const;
export const productInclude = {
  // a Variant is a seller OFFER; `seller` is null for store-owned offers
  variants: { orderBy: { position: "asc" }, include: { seller: { select: sellerSelect } } },
  options: { orderBy: { position: "asc" } },
  category: true,
  seller: { select: sellerSelect }, // creator of the canonical product record (not necessarily the offer seller)
  reviews: { where: { status: "PUBLISHED" }, select: { rating: true } },
} satisfies Prisma.ProductInclude;
export type CatalogProduct = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

type V = { price: number; stock: number; trackInventory: boolean; continueSelling: boolean };
export function bestVariant<T extends V>(p: { variants: T[] }): T | undefined {
  const avail = p.variants.filter(isAvailable);
  const pool = avail.length ? avail : p.variants;
  return pool.reduce<T | undefined>((a, b) => (!a || b.price < a.price ? b : a), undefined);
}

export function rating(p: { reviews: { rating: number }[] }) {
  if (!p.reviews.length) return null;
  return { avg: p.reviews.reduce((s, r) => s + r.rating, 0) / p.reviews.length, count: p.reviews.length };
}

/** Values of the option named "Condition" that are in stock, if the product has one. */
export function availableConditions(p: CatalogProduct) {
  const idx = p.options.findIndex((o) => o.name.toLowerCase() === "condition");
  if (idx < 0) return [];
  const key = (["option1", "option2", "option3"] as const)[idx];
  return [...new Set(p.variants.filter(isAvailable).map((v) => v[key]).filter((x): x is string => !!x))];
}

export type ProductQuery = {
  q?: string; category?: string; categories?: string[]; brand?: string[]; sellers?: string[]; options?: Record<string, string[]>;
  min?: number; max?: number; sort?: string; express?: boolean; featured?: boolean; inStock?: boolean; ids?: string[]; rating?: number;
};

const OPT_KEYS = ["option1", "option2", "option3"] as const;
/** Values a product offers for an option name (case-insensitive), optionally only in-stock ones. */
export function optionValues(p: CatalogProduct, name: string, availableOnly = false) {
  const idx = p.options.findIndex((o) => o.name.toLowerCase() === name.toLowerCase());
  if (idx < 0) return [];
  const key = OPT_KEYS[idx];
  return [...new Set(p.variants.filter((v) => !availableOnly || isAvailable(v)).map((v) => v[key]).filter((x): x is string => !!x))];
}

/** DB-level offer visibility: approved offer, from the store or an approved seller (vacation is checked in memory by offerListed). */
export const listedVariantWhere: Prisma.VariantWhereInput = { approvalStatus: "APPROVED", OR: [{ sellerId: null }, { seller: { status: "APPROVED" } }] };
/** Storefront visibility: active + approved product that still has at least one listed offer. */
export const visibleWhere: Prisma.ProductWhereInput = { status: "ACTIVE", approvalStatus: "APPROVED", variants: { some: listedVariantWhere } };

/** In-memory pass: drop offers that can't be shown (unapproved, suspended seller, vacation) and products left without offers. */
export function listedProducts<T extends { variants: OfferLike[] }>(products: T[]): T[] {
  return products.map((p) => ({ ...p, variants: p.variants.filter(offerListed) })).filter((p) => p.variants.length) as T[];
}

const sellerKey = (v: { seller?: { slug: string } | null }) => v.seller?.slug ?? "store";

async function baseProducts(query: ProductQuery) {
  const where: Prisma.ProductWhereInput = { ...visibleWhere };
  if (query.ids) where.id = { in: query.ids };
  if (query.category) where.category = { slug: query.category };
  if (query.express) where.express = true;
  if (query.featured) where.featured = true;
  if (query.q) {
    const terms = query.q.trim().split(/\s+/).slice(0, 6);
    where.AND = terms.map((t) => ({
      OR: [{ name: { contains: t } }, { nameAr: { contains: t } }, { brand: { contains: t } }, { description: { contains: t } }, { descriptionAr: { contains: t } }, { specs: { contains: t } }, { tags: { contains: t } }, { productType: { contains: t } }],
    }));
  }
  return listedProducts(await db.product.findMany({ where, include: productInclude, orderBy: { createdAt: "desc" } }));
}

type FilterKey = "brand" | "options" | "price" | "stock" | "rating" | "categories" | "sellers";
function applyFilters(list: CatalogProduct[], q: ProductQuery, skip?: FilterKey, skipOption?: string) {
  return list.filter((p) => {
    if (skip !== "brand" && q.brand?.length && !q.brand.includes(p.brand)) return false;
    if (skip !== "categories" && q.categories?.length && !q.categories.includes(p.category.slug)) return false;
    if (skip !== "sellers" && q.sellers?.length && !p.variants.some((v) => q.sellers!.includes(sellerKey(v)))) return false;
    if (q.options) {
      for (const [name, vals] of Object.entries(q.options)) {
        if (!vals.length || (skip === "options" && skipOption === name)) continue;
        if (!optionValues(p, name).some((v) => vals.includes(v))) return false;
      }
    }
    if (skip !== "price" && (q.min != null || q.max != null)) {
      if (!p.variants.some((v) => v.price >= (q.min ?? 0) && v.price <= (q.max ?? 1e9))) return false;
    }
    if (skip !== "stock" && q.inStock && !p.variants.some(isAvailable)) return false;
    if (skip !== "rating" && q.rating) {
      const r = rating(p);
      if (!r || r.avg < q.rating) return false;
    }
    return true;
  });
}

function sortList(products: CatalogProduct[], sort?: string) {
  const price = (p: CatalogProduct) => bestVariant(p)?.price ?? 0;
  const off = (p: CatalogProduct) => (p.priceNew ? 1 - price(p) / p.priceNew : 0);
  const list = [...products];
  switch (sort) {
    case "price-asc": return list.sort((a, b) => price(a) - price(b));
    case "price-desc": return list.sort((a, b) => price(b) - price(a));
    case "discount": return list.sort((a, b) => off(b) - off(a));
    case "newest": return list.sort((a, b) => +b.createdAt - +a.createdAt);
    case "name": return list.sort((a, b) => a.name.localeCompare(b.name));
    case "rating": return list.sort((a, b) => (rating(b)?.avg ?? 0) - (rating(a)?.avg ?? 0));
    default: return list.sort((a, b) => Number(b.featured) - Number(a.featured) || Number(b.variants.some(isAvailable)) - Number(a.variants.some(isAvailable)));
  }
}

/** When filtering by seller, only that seller's offers should drive the displayed price. */
function narrowToSellers(products: CatalogProduct[], q: ProductQuery) {
  return q.sellers?.length ? products.map((p) => ({ ...p, variants: p.variants.filter((v) => q.sellers!.includes(sellerKey(v))) })) : products;
}

export async function searchProducts(query: ProductQuery) {
  return sortList(narrowToSellers(applyFilters(await baseProducts(query), query), query), query.sort);
}

export type Facets = {
  brands: { value: string; count: number }[];
  categories: { slug: string; name: string; nameAr: string; count: number }[];
  options: { name: string; nameAr: string; values: { value: string; count: number }[] }[];
  priceRange: [number, number];
  sellers: { slug: string; name: string; count: number }[];
  inStockCount: number;
};

/** Products plus facet counts (each facet is counted with all *other* filters applied, like Revibe/Shopify). */
export async function searchWithFacets(query: ProductQuery): Promise<{ products: CatalogProduct[]; facets: Facets }> {
  const base = await baseProducts(query);
  const products = sortList(narrowToSellers(applyFilters(base, query), query), query.sort);
  const count = <T,>(list: CatalogProduct[], key: (p: CatalogProduct) => T[]) => {
    const m = new Map<T, number>();
    list.forEach((p) => new Set(key(p)).forEach((k) => m.set(k, (m.get(k) ?? 0) + 1)));
    return m;
  };
  const brandMap = count(applyFilters(base, query, "brand"), (p) => [p.brand]);
  const catList = applyFilters(base, query, "categories");
  const catMap = new Map<string, { slug: string; name: string; nameAr: string; count: number }>();
  catList.forEach((p) => {
    const c = catMap.get(p.category.slug) ?? { slug: p.category.slug, name: p.category.name, nameAr: p.category.nameAr, count: 0 };
    c.count++;
    catMap.set(p.category.slug, c);
  });
  // option names across the base set, Condition first
  const names = new Map<string, string>();
  base.forEach((p) => p.options.forEach((o) => { if (!names.has(o.name)) names.set(o.name, o.nameAr); }));
  const order = (n: string) => (n.toLowerCase() === "condition" ? 0 : 1);
  const options = [...names.entries()].sort((a, b) => order(a[0]) - order(b[0])).map(([name, nameAr]) => {
    const m = count(applyFilters(base, query, "options", name), (p) => optionValues(p, name));
    const condOrder = ["Brand New", "Excellent", "Very Good", "Good"];
    const values = [...m.entries()].map(([value, c]) => ({ value, count: c }))
      .sort((a, b) => (name.toLowerCase() === "condition" ? condOrder.indexOf(a.value) - condOrder.indexOf(b.value) : a.value.localeCompare(b.value, undefined, { numeric: true })));
    return { name, nameAr, values };
  }).filter((o) => o.values.length > 1 || (o.values.length === 1 && o.name.toLowerCase() === "condition"));
  const sellerMap = new Map<string, { slug: string; name: string; count: number }>();
  applyFilters(base, query, "sellers").forEach((p) => {
    for (const v of new Map(p.variants.map((x) => [sellerKey(x), x])).values()) {
      const k = sellerKey(v);
      const e = sellerMap.get(k) ?? { slug: k, name: v.seller?.shopName ?? "TechRevive", count: 0 };
      e.count++;
      sellerMap.set(k, e);
    }
  });
  const prices = base.flatMap((p) => p.variants.map((v) => v.price));
  return {
    products,
    facets: {
      brands: [...brandMap.entries()].map(([value, c]) => ({ value, count: c })).sort((a, b) => a.value.localeCompare(b.value)),
      categories: [...catMap.values()].sort((a, b) => b.count - a.count),
      options,
      priceRange: [Math.floor(Math.min(...prices, 0)), Math.ceil(Math.max(...prices, 0))],
      sellers: [...sellerMap.values()].sort((a, b) => b.count - a.count),
      inStockCount: applyFilters(base, query, "stock").filter((p) => p.variants.some(isAvailable)).length,
    },
  };
}

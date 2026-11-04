import "server-only";
import type { Collection } from "@prisma/client";
import { db } from "./db";
import { productInclude, bestVariant, listedProducts, type CatalogProduct } from "./catalog";

export type Rule = { field: string; op: string; value: string };
export const RULE_FIELDS = {
  title: "Product title", vendor: "Vendor / brand", type: "Product type", category: "Category (slug)", tag: "Tag",
  price: "Price (lowest variant)", compareDiscount: "% off vs new", stock: "Inventory stock", express: "Express eligible (true/false)",
} as const;
export const RULE_OPS = { eq: "is equal to", neq: "is not equal to", gt: "is greater than", lt: "is less than", contains: "contains", ncontains: "does not contain" } as const;

export function parseRules(s: string): Rule[] {
  try {
    const r = JSON.parse(s);
    return Array.isArray(r) ? r : [];
  } catch {
    return [];
  }
}

function fieldValue(p: CatalogProduct, field: string): string | number | string[] {
  const best = bestVariant(p);
  switch (field) {
    case "title": return p.name;
    case "vendor": return p.brand;
    case "type": return p.productType;
    case "category": return p.category.slug;
    case "tag": return p.tags.split(",").map((t) => t.trim()).filter(Boolean);
    case "price": return best?.price ?? 0;
    case "compareDiscount": return best && p.priceNew ? Math.round((1 - best.price / p.priceNew) * 100) : 0;
    case "stock": return p.variants.reduce((s, v) => s + v.stock, 0);
    case "express": return String(p.express);
    default: return "";
  }
}

export function matchRule(p: CatalogProduct, r: Rule) {
  const v = fieldValue(p, r.field);
  const target = r.value.toLowerCase();
  if (Array.isArray(v)) {
    const vals = v.map((x) => x.toLowerCase());
    if (r.op === "eq" || r.op === "contains") return vals.some((x) => (r.op === "eq" ? x === target : x.includes(target)));
    if (r.op === "neq" || r.op === "ncontains") return !vals.some((x) => (r.op === "neq" ? x === target : x.includes(target)));
    return false;
  }
  if (typeof v === "number") {
    const n = Number(r.value);
    return r.op === "eq" ? v === n : r.op === "neq" ? v !== n : r.op === "gt" ? v > n : r.op === "lt" ? v < n : false;
  }
  const s = v.toLowerCase();
  return r.op === "eq" ? s === target : r.op === "neq" ? s !== target : r.op === "contains" ? s.includes(target) : r.op === "ncontains" ? !s.includes(target) : false;
}

export function sortProducts(products: CatalogProduct[], order: string) {
  const price = (p: CatalogProduct) => bestVariant(p)?.price ?? 0;
  const list = [...products];
  switch (order) {
    case "PRICE_ASC": return list.sort((a, b) => price(a) - price(b));
    case "PRICE_DESC": return list.sort((a, b) => price(b) - price(a));
    case "NEWEST": return list.sort((a, b) => +b.createdAt - +a.createdAt);
    case "TITLE": return list.sort((a, b) => a.name.localeCompare(b.name));
    case "BEST": return list.sort((a, b) => Number(b.featured) - Number(a.featured));
    default: return list;
  }
}

/** Resolves the products in a collection (manual membership or smart rules). */
export async function getCollectionProducts(c: Collection, opts: { includeInactive?: boolean } = {}) {
  const statusWhere = opts.includeInactive ? {} : { status: "ACTIVE" };
  if (c.type === "SMART") {
    const rules = parseRules(c.rules);
    const all = listedProducts(await db.product.findMany({ where: statusWhere, include: productInclude }));
    const matched = rules.length ? all.filter((p) => (c.disjunctive ? rules.some((r) => matchRule(p, r)) : rules.every((r) => matchRule(p, r)))) : [];
    return sortProducts(matched, c.sortOrder === "MANUAL" ? "BEST" : c.sortOrder);
  }
  const links = await db.collectionProduct.findMany({
    where: { collectionId: c.id, product: statusWhere },
    include: { product: { include: productInclude } },
    orderBy: { position: "asc" },
  });
  return sortProducts(listedProducts(links.map((l) => l.product)), c.sortOrder);
}

/** Collection ids a product belongs to (manual + smart). Used by discounts. */
export async function collectionIdsForProducts(productIds: string[]) {
  const map = new Map<string, Set<string>>();
  productIds.forEach((id) => map.set(id, new Set()));
  const manual = await db.collectionProduct.findMany({ where: { productId: { in: productIds } } });
  manual.forEach((m) => map.get(m.productId)?.add(m.collectionId));
  const smart = await db.collection.findMany({ where: { type: "SMART" } });
  if (smart.length) {
    const products = await db.product.findMany({ where: { id: { in: productIds } }, include: productInclude });
    for (const c of smart) {
      const rules = parseRules(c.rules);
      for (const p of products)
        if (rules.length && (c.disjunctive ? rules.some((r) => matchRule(p, r)) : rules.every((r) => matchRule(p, r)))) map.get(p.id)?.add(c.id);
    }
  }
  return map;
}

import "server-only";
import { db } from "@/lib/db";
import { parseSpecs, parseValues } from "@/lib/format";
import type { ProductInput } from "@/app/actions/admin/products";

export async function editorLookups() {
  const [categories, collections] = await Promise.all([
    db.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.collection.findMany({ where: { type: "MANUAL" }, orderBy: { title: "asc" }, select: { id: true, title: true } }),
  ]);
  return { categories, collections };
}

export const storeHost = () => (process.env.NEXT_PUBLIC_SITE_URL || "https://techrevive.ae").replace(/^https?:\/\//, "").replace(/\/$/, "");

export function emptyProduct(categoryId = ""): ProductInput {
  return {
    name: "", nameAr: "", description: "", descriptionAr: "", status: "DRAFT", categoryId, brand: "", productType: "", tags: "", collectionIds: [],
    priceNew: "", featured: false, express: false, specs: [], seoTitle: "", seoDescription: "", slug: "", images: [],
    options: [{ name: "Condition", nameAr: "الحالة", values: ["Brand New"] }],
    variants: [{ option1: "Brand New", option2: null, option3: null, price: "", comparePrice: "", cost: "", sku: "", barcode: "", stock: 0, weight: "", trackInventory: true, continueSelling: false, image: "" }],
  };
}

export async function loadProductInput(id: string) {
  const p = await db.product.findUnique({
    where: { id },
    include: { variants: { orderBy: { position: "asc" } }, options: { orderBy: { position: "asc" } }, images: { orderBy: { position: "asc" } }, collections: true, category: true },
  });
  if (!p) return null;
  const input: ProductInput = {
    id: p.id, name: p.name, nameAr: p.nameAr, description: p.description, descriptionAr: p.descriptionAr, status: p.status, categoryId: p.categoryId,
    brand: p.brand, productType: p.productType, tags: p.tags.split(",").filter(Boolean).join(", "), collectionIds: p.collections.map((c) => c.collectionId),
    priceNew: p.priceNew || "", featured: p.featured, express: p.express,
    specs: Object.entries(parseSpecs(p.specs)).map(([key, value]) => ({ key, value })),
    seoTitle: p.seoTitle ?? "", seoDescription: p.seoDescription ?? "", slug: p.slug,
    images: p.images.length ? p.images.map((i) => ({ url: i.url, alt: i.alt })) : p.image ? [{ url: p.image, alt: p.name }] : [],
    options: p.options.map((o) => ({ name: o.name, nameAr: o.nameAr, values: parseValues(o.values) })),
    variants: p.variants.map((v) => ({
      id: v.id, option1: v.option1, option2: v.option2, option3: v.option3, price: v.price, comparePrice: v.comparePrice ?? "", cost: v.cost ?? "",
      sku: v.sku ?? "", barcode: v.barcode ?? "", stock: v.stock, weight: v.weight ?? "", trackInventory: v.trackInventory, continueSelling: v.continueSelling, image: v.image ?? "",
    })),
  };
  return { product: p, input };
}

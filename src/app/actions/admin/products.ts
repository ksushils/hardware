"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { adjustStock } from "@/lib/orders";
import { csv, slugify } from "@/lib/format";

export type VariantInput = {
  id?: string; option1: string | null; option2: string | null; option3: string | null;
  price: number | string; comparePrice: number | string | null; cost: number | string | null; sku: string; barcode: string;
  stock: number | string; weight: number | string | null; trackInventory: boolean; continueSelling: boolean; image: string;
};
export type ProductInput = {
  id?: string; name: string; nameAr: string; description: string; descriptionAr: string; status: string; categoryId: string;
  brand: string; productType: string; tags: string; collectionIds: string[]; priceNew: number | string; featured: boolean; express: boolean;
  specs: { key: string; value: string }[]; seoTitle: string; seoDescription: string; slug: string;
  images: { url: string; alt: string }[]; options: { name: string; nameAr: string; values: string[] }[]; variants: VariantInput[];
};
export type SaveResult = { ok?: boolean; id?: string; error?: string; fieldErrors?: Record<string, string> };

const n = (v: unknown) => (v === "" || v == null ? null : Number(v));

export async function saveProduct(input: ProductInput): Promise<SaveResult> {
  const user = await requirePermission("products");
  const fe: Record<string, string> = {};
  const name = input.name.trim();
  if (!name) fe.name = "Title is required.";
  if (!input.categoryId) fe.categoryId = "Choose a category.";
  if (!input.brand.trim()) fe.brand = "Vendor is required.";
  if (!["ACTIVE", "DRAFT", "ARCHIVED"].includes(input.status)) fe.status = "Invalid status.";
  const priceNew = n(input.priceNew) ?? 0;
  if (Number.isNaN(priceNew) || priceNew < 0) fe.priceNew = "Must be a positive number.";
  const options = input.options.map((o) => ({ ...o, name: o.name.trim(), values: [...new Set(o.values.map((v) => v.trim()).filter(Boolean))] })).filter((o) => o.name);
  if (options.length > 3) fe.options = "Up to 3 options.";
  if (options.some((o) => !o.values.length)) fe.options = "Every option needs at least one value.";
  if (new Set(options.map((o) => o.name.toLowerCase())).size !== options.length) fe.options = "Option names must be unique.";
  if (!input.variants.length) fe.variants = "Add at least one variant.";
  const skus = input.variants.map((v) => v.sku.trim()).filter(Boolean);
  if (new Set(skus.map((s) => s.toUpperCase())).size !== skus.length) fe.variants = "SKUs must be unique.";
  input.variants.forEach((v, i) => {
    const p = n(v.price);
    if (p == null || Number.isNaN(p) || p < 0) fe[`variant_${i}_price`] = "Price required";
    for (const k of ["comparePrice", "cost", "weight", "stock"] as const) {
      const x = n(v[k]);
      if (x != null && (Number.isNaN(x) || x < 0)) fe[`variant_${i}_${k}`] = "Invalid";
    }
  });
  const slug = slugify(input.slug || name);
  if (!slug) fe.slug = "URL handle is required.";
  if (slug) {
    const clash = await db.product.findFirst({ where: { slug, NOT: input.id ? { id: input.id } : undefined } });
    if (clash) fe.slug = "This URL handle is already used by another product.";
  }
  if (skus.length) {
    const taken = await db.variant.findMany({ where: { sku: { in: skus }, NOT: input.id ? { productId: input.id } : undefined }, select: { sku: true } });
    if (taken.length) fe.variants = `SKU already in use: ${taken.map((t) => t.sku).join(", ")}`;
  }
  if (Object.keys(fe).length) return { error: "Please fix the highlighted fields.", fieldErrors: fe };

  const specs = Object.fromEntries(input.specs.filter((s) => s.key.trim()).map((s) => [s.key.trim(), s.value.trim()]));
  const images = input.images.filter((i) => i.url.trim());
  const data = {
    name, nameAr: input.nameAr.trim(), description: input.description, descriptionAr: input.descriptionAr, status: input.status,
    categoryId: input.categoryId, brand: input.brand.trim(), productType: input.productType.trim(), tags: csv(input.tags).join(","),
    priceNew, featured: input.featured, express: input.express, specs: JSON.stringify(specs),
    seoTitle: input.seoTitle.trim() || null, seoDescription: input.seoDescription.trim() || null, slug, image: images[0]?.url ?? "",
  };

  const isNew = !input.id;
  const product = input.id ? await db.product.update({ where: { id: input.id }, data }) : await db.product.create({ data });
  const productId = product.id;

  await db.productImage.deleteMany({ where: { productId } });
  if (images.length) await db.productImage.createMany({ data: images.map((im, i) => ({ productId, url: im.url.trim(), alt: im.alt, position: i })) });
  await db.productOption.deleteMany({ where: { productId } });
  if (options.length) await db.productOption.createMany({ data: options.map((o, i) => ({ productId, name: o.name, nameAr: o.nameAr.trim(), position: i, values: JSON.stringify(o.values) })) });

  // variants
  const existing = await db.variant.findMany({ where: { productId } });
  const keep = new Set<string>();
  for (const [i, v] of input.variants.entries()) {
    const vals = [v.option1, v.option2, v.option3].map((x, idx) => (idx < options.length ? x?.trim() || null : null));
    const fields = {
      title: vals.filter(Boolean).join(" / ") || "Default Title", option1: vals[0], option2: vals[1], option3: vals[2],
      price: Number(v.price), comparePrice: n(v.comparePrice), cost: n(v.cost), sku: v.sku.trim() || null, barcode: v.barcode.trim() || null,
      weight: n(v.weight), trackInventory: v.trackInventory, continueSelling: v.continueSelling, image: v.image.trim() || null, position: i,
    };
    const stock = Math.trunc(Number(v.stock) || 0);
    const match = v.id ? existing.find((e) => e.id === v.id) : undefined;
    if (match) {
      keep.add(match.id);
      await db.variant.update({ where: { id: match.id }, data: fields });
      if (stock !== match.stock) await adjustStock(match.id, stock - match.stock, "correction", user.id, "Edited in product editor");
    } else {
      const nv = await db.variant.create({ data: { ...fields, productId, stock: 0 } });
      keep.add(nv.id);
      if (stock) await adjustStock(nv.id, stock, "received", user.id, "Initial stock");
    }
  }
  const remove = existing.filter((e) => !keep.has(e.id)).map((e) => e.id);
  if (remove.length) await db.variant.deleteMany({ where: { id: { in: remove } } });

  // manual collection membership
  const manual = await db.collection.findMany({ where: { type: "MANUAL" }, select: { id: true } });
  const manualIds = manual.map((m) => m.id);
  const wanted = input.collectionIds.filter((id) => manualIds.includes(id));
  await db.collectionProduct.deleteMany({ where: { productId, collectionId: { in: manualIds.filter((id) => !wanted.includes(id)) } } });
  for (const cid of wanted) {
    const exists = await db.collectionProduct.findUnique({ where: { collectionId_productId: { collectionId: cid, productId } } });
    if (!exists) await db.collectionProduct.create({ data: { collectionId: cid, productId, position: await db.collectionProduct.count({ where: { collectionId: cid } }) } });
  }

  await logActivity(user, isNew ? "created" : "updated", "product", `${isNew ? "Created" : "Updated"} product "${name}"`, productId);
  revalidatePath("/", "layout");
  return { ok: true, id: productId };
}

export async function deleteProduct(formData: FormData) {
  const user = await requirePermission("products");
  const id = String(formData.get("id"));
  const p = await db.product.delete({ where: { id } }).catch(() => null);
  if (p) await logActivity(user, "deleted", "product", `Deleted product "${p.name}"`, id);
  revalidatePath("/", "layout");
  redirect("/admin/products");
}

export async function duplicateProduct(formData: FormData) {
  const user = await requirePermission("products");
  const id = String(formData.get("id"));
  const src = await db.product.findUnique({ where: { id }, include: { variants: true, options: true, images: true, collections: true } });
  if (!src) redirect("/admin/products");
  let slug = `${src.slug}-copy`;
  for (let i = 2; await db.product.findUnique({ where: { slug } }); i++) slug = `${src.slug}-copy-${i}`;
  const copy = await db.product.create({
    data: {
      slug, name: `Copy of ${src.name}`, nameAr: src.nameAr, brand: src.brand, productType: src.productType, description: src.description, descriptionAr: src.descriptionAr,
      specs: src.specs, image: src.image, status: "DRAFT", categoryId: src.categoryId, priceNew: src.priceNew, tags: src.tags, seoTitle: src.seoTitle, seoDescription: src.seoDescription,
      featured: false, express: src.express,
      images: { create: src.images.map(({ url, alt, position }) => ({ url, alt, position })) },
      options: { create: src.options.map(({ name, nameAr, position, values }) => ({ name, nameAr, position, values })) },
      variants: { create: src.variants.map(({ title, option1, option2, option3, price, comparePrice, cost, barcode, trackInventory, continueSelling, weight, image, position }) => ({ title, option1, option2, option3, price, comparePrice, cost, barcode, trackInventory, continueSelling, weight, image, position, stock: 0, sku: null })) },
      collections: { create: src.collections.map(({ collectionId, position }) => ({ collectionId, position })) },
    },
  });
  await logActivity(user, "created", "product", `Duplicated "${src.name}" as draft`, copy.id);
  redirect(`/admin/products/${copy.id}?duplicated=1`);
}

export async function bulkProducts(ids: string[], action: string, value = ""): Promise<{ ok?: boolean; error?: string; count?: number }> {
  const user = await requirePermission("products");
  if (!ids.length) return { error: "No products selected." };
  let count = 0;
  if (["ACTIVE", "DRAFT", "ARCHIVED"].includes(action)) {
    count = (await db.product.updateMany({ where: { id: { in: ids } }, data: { status: action } })).count;
  } else if (action === "addTag" || action === "removeTag") {
    const tag = value.trim();
    if (!tag) return { error: "Enter a tag." };
    const products = await db.product.findMany({ where: { id: { in: ids } }, select: { id: true, tags: true } });
    for (const p of products) {
      const tags = csv(p.tags);
      const next = action === "addTag" ? [...new Set([...tags, tag])] : tags.filter((t) => t.toLowerCase() !== tag.toLowerCase());
      await db.product.update({ where: { id: p.id }, data: { tags: next.join(",") } });
      count++;
    }
  } else if (action === "feature" || action === "unfeature") {
    count = (await db.product.updateMany({ where: { id: { in: ids } }, data: { featured: action === "feature" } })).count;
  } else if (action === "delete") {
    count = (await db.product.deleteMany({ where: { id: { in: ids } } })).count;
  } else return { error: "Unknown action." };
  await logActivity(user, "bulk", "product", `Bulk "${action}${value ? ` ${value}` : ""}" on ${count} product(s)`);
  revalidatePath("/", "layout");
  return { ok: true, count };
}

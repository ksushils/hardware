"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Collection } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { getCollectionProducts, type Rule } from "@/lib/collections";
import { slugify } from "@/lib/format";

export type CollectionInput = {
  id?: string; title: string; titleAr: string; description: string; descriptionAr: string; handle: string; image: string;
  type: "MANUAL" | "SMART"; rules: Rule[]; disjunctive: boolean; sortOrder: string; published: boolean; showOnHome: boolean;
  seoTitle: string; seoDescription: string; productIds: string[];
};

export async function saveCollection(input: CollectionInput): Promise<{ ok?: boolean; id?: string; error?: string }> {
  const user = await requirePermission("products");
  const title = input.title.trim();
  if (!title) return { error: "Title is required." };
  const handle = slugify(input.handle || title);
  const clash = await db.collection.findFirst({ where: { handle, NOT: input.id ? { id: input.id } : undefined } });
  if (clash) return { error: "This URL handle is already used by another collection." };
  const rules = input.rules.filter((r) => r.field && r.op && r.value.trim() !== "");
  if (input.type === "SMART" && !rules.length) return { error: "Smart collections need at least one condition." };
  const data = {
    title, titleAr: input.titleAr.trim(), description: input.description, descriptionAr: input.descriptionAr, handle, image: input.image.trim() || null,
    type: input.type, rules: JSON.stringify(rules), disjunctive: input.disjunctive, sortOrder: input.sortOrder, published: input.published, showOnHome: input.showOnHome,
    seoTitle: input.seoTitle.trim() || null, seoDescription: input.seoDescription.trim() || null,
  };
  const c = input.id ? await db.collection.update({ where: { id: input.id }, data }) : await db.collection.create({ data });
  if (input.type === "MANUAL") {
    await db.collectionProduct.deleteMany({ where: { collectionId: c.id } });
    const ids = [...new Set(input.productIds)];
    if (ids.length) await db.collectionProduct.createMany({ data: ids.map((productId, position) => ({ collectionId: c.id, productId, position })) });
  } else {
    await db.collectionProduct.deleteMany({ where: { collectionId: c.id } });
  }
  await logActivity(user, input.id ? "updated" : "created", "collection", `${input.id ? "Updated" : "Created"} collection "${title}"`, c.id);
  revalidatePath("/", "layout");
  return { ok: true, id: c.id };
}

export async function deleteCollection(formData: FormData) {
  const user = await requirePermission("products");
  const id = String(formData.get("id"));
  const c = await db.collection.delete({ where: { id } }).catch(() => null);
  if (c) await logActivity(user, "deleted", "collection", `Deleted collection "${c.title}"`, id);
  revalidatePath("/", "layout");
  redirect("/admin/collections");
}

/** Live preview for the smart-collection rules builder. */
export async function previewSmart(rules: Rule[], disjunctive: boolean, sortOrder: string) {
  await requirePermission("products");
  const fake = { type: "SMART", rules: JSON.stringify(rules.filter((r) => r.value.trim() !== "")), disjunctive, sortOrder } as Collection;
  const products = await getCollectionProducts(fake, { includeInactive: false });
  return { count: products.length, sample: products.slice(0, 8).map((p) => ({ id: p.id, name: p.name, image: p.image })) };
}

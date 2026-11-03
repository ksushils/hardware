"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { CONDITION_ORDER, ORDER_STATUSES } from "@/lib/format";
import { restock } from "@/lib/orders";
import type { FormState } from "./auth";

function slugify(s: string) {
  return s.toLowerCase().replace(/["']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function saveProduct(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const brand = String(formData.get("brand") || "").trim();
  const categoryId = String(formData.get("categoryId") || "");
  const priceNew = Number(formData.get("priceNew"));
  if (!name || !brand || !categoryId || !(priceNew > 0)) return { error: "Name, brand, category and new price are required." };

  const specs: Record<string, string> = {};
  for (const line of String(formData.get("specs") || "").split("\n")) {
    const [k, ...rest] = line.split(":");
    if (k?.trim() && rest.length) specs[k.trim()] = rest.join(":").trim();
  }
  const data = {
    name, brand, categoryId, priceNew,
    description: String(formData.get("description") || ""),
    image: String(formData.get("image") || "/img/gpu.svg"),
    specs: JSON.stringify(specs),
    featured: formData.get("featured") === "on",
    express: formData.get("express") === "on",
    active: formData.get("active") === "on",
  };

  const product = id
    ? await db.product.update({ where: { id }, data })
    : await db.product.create({ data: { ...data, slug: `${slugify(`${brand} ${name}`)}-${Math.random().toString(36).slice(2, 6)}` } });

  for (const c of CONDITION_ORDER) {
    const priceRaw = String(formData.get(`price_${c}`) || "");
    const stock = Math.max(0, Math.floor(Number(formData.get(`stock_${c}`) || 0)));
    const existing = await db.variant.findFirst({ where: { productId: product.id, condition: c } });
    if (priceRaw && Number(priceRaw) > 0) {
      const price = Number(priceRaw);
      if (existing) await db.variant.update({ where: { id: existing.id }, data: { price, stock } });
      else await db.variant.create({ data: { productId: product.id, condition: c, price, stock, sku: `${product.slug.slice(0, 24)}-${c}`.toUpperCase() } });
    } else if (existing) {
      // Variants referenced by past orders can't be deleted; zero their stock instead.
      const used = await db.orderItem.count({ where: { variantId: existing.id } });
      if (used) await db.variant.update({ where: { id: existing.id }, data: { stock: 0 } });
      else await db.variant.delete({ where: { id: existing.id } });
    }
  }
  revalidatePath("/", "layout");
  redirect("/admin/products");
}

export async function deleteProduct(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const used = await db.orderItem.count({ where: { variant: { productId: id } } });
  if (used) await db.product.update({ where: { id }, data: { active: false } });
  else await db.product.delete({ where: { id } });
  revalidatePath("/", "layout");
}

export async function updateOrderStatus(formData: FormData) {
  await requireAdmin();
  const number = String(formData.get("number"));
  const status = String(formData.get("status"));
  if (!ORDER_STATUSES.includes(status)) return;
  const order = await db.order.findUniqueOrThrow({ where: { number } });
  const wasCancelled = ["CANCELLED", "REFUNDED"].includes(order.status);
  const nowCancelled = ["CANCELLED", "REFUNDED"].includes(status);
  const data: { status: string; paymentStatus?: string } = { status };
  if (status === "REFUNDED") data.paymentStatus = "REFUNDED";
  if (status === "DELIVERED" && order.paymentMethod === "COD") data.paymentStatus = "PAID";
  await db.order.update({ where: { number }, data });
  if (nowCancelled && !wasCancelled) await restock(order.id);
  revalidatePath(`/admin/orders/${number}`);
  revalidatePath("/admin/orders");
}

export async function saveCoupon(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const code = String(formData.get("code") || "").trim().toUpperCase();
  const type = String(formData.get("type"));
  const value = Number(formData.get("value"));
  const minSpend = Number(formData.get("minSpend") || 0);
  const expires = String(formData.get("expiresAt") || "");
  if (!/^[A-Z0-9]{3,20}$/.test(code)) return { error: "Code must be 3–20 letters/numbers." };
  if (!["PERCENT", "FIXED"].includes(type) || !(value > 0) || (type === "PERCENT" && value > 100)) return { error: "Invalid discount value." };
  await db.coupon.upsert({
    where: { code },
    update: { type, value, minSpend, active: true, expiresAt: expires ? new Date(expires) : null },
    create: { code, type, value, minSpend, expiresAt: expires ? new Date(expires) : null },
  });
  revalidatePath("/admin/coupons");
  return { ok: `Coupon ${code} saved.` };
}

export async function toggleCoupon(formData: FormData) {
  await requireAdmin();
  const c = await db.coupon.findUniqueOrThrow({ where: { id: String(formData.get("id")) } });
  await db.coupon.update({ where: { id: c.id }, data: { active: !c.active } });
  revalidatePath("/admin/coupons");
}

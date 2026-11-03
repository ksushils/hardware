"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readCart, writeCart } from "@/lib/cart";

export async function addToCart(formData: FormData) {
  const variantId = String(formData.get("variantId") || "");
  const qty = Math.max(1, Math.min(10, Number(formData.get("quantity") || 1)));
  const warranty = formData.get("warranty") === "on";
  const buyNow = formData.get("buyNow") === "1";
  const variant = await db.variant.findUnique({ where: { id: variantId } });
  if (!variant || variant.stock < 1) return;
  const cart = await readCart();
  const existing = cart.find((e) => e.v === variantId);
  if (existing) {
    existing.q = Math.min(variant.stock, existing.q + qty);
    existing.w = existing.w || warranty;
  } else cart.push({ v: variantId, q: Math.min(variant.stock, qty), w: warranty });
  await writeCart(cart);
  revalidatePath("/", "layout");
  redirect(buyNow ? "/checkout" : "/cart?added=1");
}

export async function updateCartItem(formData: FormData) {
  const variantId = String(formData.get("variantId") || "");
  const qty = Number(formData.get("quantity"));
  const cart = await readCart();
  const entry = cart.find((e) => e.v === variantId);
  if (entry) {
    if (!qty || qty < 1) cart.splice(cart.indexOf(entry), 1);
    else {
      const variant = await db.variant.findUnique({ where: { id: variantId } });
      entry.q = Math.min(qty, variant?.stock ?? qty, 10);
    }
    await writeCart(cart);
  }
  revalidatePath("/", "layout");
}

export async function toggleWarranty(formData: FormData) {
  const variantId = String(formData.get("variantId") || "");
  const cart = await readCart();
  const entry = cart.find((e) => e.v === variantId);
  if (entry) {
    entry.w = !entry.w;
    await writeCart(cart);
  }
  revalidatePath("/", "layout");
}

export async function removeCartItem(formData: FormData) {
  const variantId = String(formData.get("variantId") || "");
  await writeCart((await readCart()).filter((e) => e.v !== variantId));
  revalidatePath("/", "layout");
}

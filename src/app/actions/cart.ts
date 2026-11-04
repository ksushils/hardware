"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { addEntry, readCart, writeCart } from "@/lib/cart";
import { maxQty } from "@/lib/inventory";

export async function addToCart(formData: FormData) {
  const variantId = String(formData.get("variantId") || "");
  const qty = Math.max(1, Math.min(20, Number(formData.get("quantity") || 1)));
  const ok = await addEntry(variantId, qty, formData.get("warranty") === "on");
  revalidatePath("/", "layout");
  if (!ok) return;
  if (formData.get("stay") === "1") return;
  redirect(formData.get("buyNow") === "1" ? "/checkout" : "/cart?added=1");
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
      entry.q = Math.min(qty, variant ? maxQty(variant, 20) : qty);
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

/** Cart → wishlist ("save for later"). */
export async function saveForLater(formData: FormData) {
  const user = await getUser();
  const variantId = String(formData.get("variantId") || "");
  if (!user) redirect("/login?next=/cart");
  const v = await db.variant.findUnique({ where: { id: variantId } });
  if (v) {
    await db.wishlistItem.upsert({ where: { userId_productId: { userId: user.id, productId: v.productId } }, update: {}, create: { userId: user.id, productId: v.productId } });
    await writeCart((await readCart()).filter((e) => e.v !== variantId));
  }
  revalidatePath("/", "layout");
}

/** Wishlist → cart: adds the cheapest available variant (or the chosen one) and removes it from the wishlist. */
export async function moveWishlistToCart(formData: FormData) {
  const user = await getUser();
  if (!user) redirect("/login?next=/account/wishlist");
  const productIds = formData.getAll("productId").map(String);
  for (const productId of productIds) {
    // cheapest approved, in-stock offer from a seller that can currently sell (addEntry re-validates everything)
    const variants = await db.variant.findMany({ where: { productId, approvalStatus: "APPROVED" }, orderBy: { price: "asc" } });
    let added = false;
    for (const v of variants.filter((x) => maxQty(x) > 0)) {
      if (await addEntry(v.id, 1)) { added = true; break; }
    }
    if (added) await db.wishlistItem.deleteMany({ where: { userId: user.id, productId } });
  }
  revalidatePath("/", "layout");
  if (formData.get("go") === "cart") redirect("/cart?added=1");
}

/** Restores a cart from an abandoned-checkout recovery link. */
export async function restoreCheckoutCart(token: string) {
  const c = await db.checkout.findUnique({ where: { token } });
  if (!c || c.recoveredOrder) return false;
  try {
    const items = JSON.parse(c.items);
    if (Array.isArray(items)) await writeCart(items);
  } catch {
    return false;
  }
  return true;
}

/** PC Builder → adds every selected part to the cart. */
export async function addBuildToCart(variantIds: string[]) {
  for (const id of variantIds.slice(0, 12)) await addEntry(id, 1);
  revalidatePath("/", "layout");
  redirect("/cart?added=1");
}

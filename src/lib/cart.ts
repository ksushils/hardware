import "server-only";
import { cookies } from "next/headers";
import { db } from "./db";
import { isAvailable, maxQty } from "./inventory";
import { sellerAllowsSales } from "./marketplace";

// Cart is stored in a cookie so it works for guests and logged-in users alike.
export type CartEntry = { v: string; q: number; w?: boolean };
const COOKIE = "tr_cart";

export async function readCart(): Promise<CartEntry[]> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e) => typeof e?.v === "string" && Number.isInteger(e?.q) && e.q > 0).slice(0, 50);
  } catch {
    return [];
  }
}

export async function writeCart(entries: CartEntry[]) {
  (await cookies()).set(COOKIE, JSON.stringify(entries), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export async function clearCart() {
  (await cookies()).delete(COOKIE);
}

/** Adds a variant (merging quantities) respecting stock. Returns false if unavailable. */
export async function addEntry(variantId: string, qty: number, warranty = false) {
  const variant = await db.variant.findUnique({ where: { id: variantId }, include: { product: { include: { seller: true } } } });
  if (!variant || variant.product.status !== "ACTIVE" || variant.product.approvalStatus !== "APPROVED" || !sellerAllowsSales(variant.product.seller) || !isAvailable(variant)) return false;
  const cart = await readCart();
  const max = maxQty(variant, 20);
  const existing = cart.find((e) => e.v === variantId);
  if (existing) {
    existing.q = Math.min(max, existing.q + qty);
    existing.w = existing.w || warranty;
  } else cart.push({ v: variantId, q: Math.min(max, qty), w: warranty });
  await writeCart(cart);
  return true;
}

export async function getCartDetails() {
  const entries = await readCart();
  if (!entries.length) return { items: [], count: 0, entries };
  const variants = await db.variant.findMany({ where: { id: { in: entries.map((e) => e.v) } }, include: { product: { include: { seller: { select: { id: true, shopName: true, slug: true, status: true, vacationMode: true } } } } } });
  const items = entries
    .map((e) => {
      const variant = variants.find((v) => v.id === e.v);
      if (!variant || variant.product.status !== "ACTIVE" || !sellerAllowsSales(variant.product.seller)) return null;
      const quantity = Math.min(e.q, maxQty(variant, 20));
      if (quantity <= 0) return null;
      return { variant, product: variant.product, quantity, warranty: !!e.w, requested: e.q };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  return { items, count: items.reduce((s, i) => s + i.quantity, 0), entries };
}

export async function cartCount() {
  return (await readCart()).reduce((s, e) => s + e.q, 0);
}

import "server-only";
import { cookies } from "next/headers";
import { db } from "./db";

// Cart is stored in a cookie so it works for guests and logged-in users alike.
export type CartEntry = { v: string; q: number; w?: boolean };
const COOKIE = "tr_cart";

export async function readCart(): Promise<CartEntry[]> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e) => typeof e?.v === "string" && Number.isInteger(e?.q) && e.q > 0)
      .slice(0, 50);
  } catch {
    return [];
  }
}

export async function writeCart(entries: CartEntry[]) {
  (await cookies()).set(COOKIE, JSON.stringify(entries), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearCart() {
  (await cookies()).delete(COOKIE);
}

export async function getCartDetails() {
  const entries = await readCart();
  if (!entries.length) return { items: [], count: 0 };
  const variants = await db.variant.findMany({
    where: { id: { in: entries.map((e) => e.v) } },
    include: { product: true },
  });
  const items = entries
    .map((e) => {
      const variant = variants.find((v) => v.id === e.v);
      if (!variant || !variant.product.active) return null;
      const quantity = Math.min(e.q, Math.max(variant.stock, 0));
      return { variant, product: variant.product, quantity, warranty: !!e.w, requested: e.q };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  return { items, count: items.reduce((s, i) => s + i.quantity, 0) };
}

export async function cartCount() {
  const entries = await readCart();
  return entries.reduce((s, e) => s + e.q, 0);
}

import "server-only";
import type { Discount } from "@prisma/client";
import { db } from "./db";
import { collectionIdsForProducts } from "./collections";

export type DiscountLine = { productId: string; price: number; quantity: number };
export type AppliedDiscount = { id: string; title: string; code: string | null; type: string; amount: number; freeShipping: boolean };

function isLive(d: Discount, now = new Date()) {
  return d.active && d.startsAt <= now && (!d.endsAt || d.endsAt >= now) && (d.usageLimit == null || d.usedCount < d.usageLimit);
}

/** Computes the discount amount for a cart, or returns an error message key. */
export async function evaluateDiscount(
  d: Discount,
  lines: DiscountLine[],
  email?: string | null,
): Promise<{ ok: true; applied: AppliedDiscount } | { ok: false; error: string }> {
  if (!isLive(d)) return { ok: false, error: "expired" };
  if (d.oncePerCustomer && email) {
    const used = await db.order.count({ where: { email: email.toLowerCase(), discountCode: d.code ?? d.title, status: { not: "CANCELLED" } } });
    if (used) return { ok: false, error: "used" };
  }
  // eligible lines
  let eligible = lines;
  const targets = d.targetIds.split(",").filter(Boolean);
  if (d.appliesTo === "PRODUCTS") eligible = lines.filter((l) => targets.includes(l.productId));
  if (d.appliesTo === "COLLECTIONS") {
    const map = await collectionIdsForProducts(lines.map((l) => l.productId));
    eligible = lines.filter((l) => [...(map.get(l.productId) ?? [])].some((c) => targets.includes(c)));
  }
  if (!eligible.length) return { ok: false, error: "notApplicable" };
  const eligibleSubtotal = eligible.reduce((s, l) => s + l.price * l.quantity, 0);
  const eligibleQty = eligible.reduce((s, l) => s + l.quantity, 0);
  if (d.minType === "AMOUNT" && eligibleSubtotal < d.minValue) return { ok: false, error: "minSpend" };
  if (d.minType === "QUANTITY" && eligibleQty < d.minValue) return { ok: false, error: "minQty" };

  let amount = 0;
  let freeShipping = false;
  if (d.type === "PERCENT") amount = eligibleSubtotal * (Math.min(d.value, 100) / 100);
  else if (d.type === "FIXED") amount = Math.min(d.value, eligibleSubtotal);
  else if (d.type === "FREE_SHIPPING") freeShipping = true;
  else if (d.type === "BXGY") {
    const buy = d.buyQty ?? 1, get = d.getQty ?? 1;
    const units = eligible.flatMap((l) => Array.from({ length: l.quantity }, () => l.price)).sort((a, b) => b - a);
    const groups = Math.floor(units.length / (buy + get));
    if (!groups) return { ok: false, error: "minQty" };
    // the cheapest units are the "get" items
    const free = units.slice(units.length - groups * get);
    amount = free.reduce((s, p) => s + p * (Math.min(d.value || 100, 100) / 100), 0);
  }
  amount = Math.round(amount * 100) / 100;
  return { ok: true, applied: { id: d.id, title: d.title, code: d.code, type: d.type, amount, freeShipping } };
}

export async function findCodeDiscount(code: string) {
  if (!code.trim()) return null;
  return db.discount.findUnique({ where: { code: code.trim().toUpperCase() } });
}

/** Best automatic discount for the cart (highest amount; free shipping counts as a small benefit). */
export async function bestAutomaticDiscount(lines: DiscountLine[], email?: string | null) {
  const autos = await db.discount.findMany({ where: { method: "AUTOMATIC", active: true } });
  let best: AppliedDiscount | null = null;
  for (const d of autos) {
    const r = await evaluateDiscount(d, lines, email);
    if (r.ok && (!best || r.applied.amount > best.amount)) best = r.applied;
  }
  return best;
}

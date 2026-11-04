import "server-only";
import { db } from "./db";

/** Shipping rates available for an emirate / cart. */
export async function availableRates(emirate: string | null, subtotal: number, allExpress: boolean) {
  const rates = await db.shippingRate.findMany({ where: { active: true }, orderBy: { position: "asc" } });
  return rates.filter((r) => {
    const em = r.emirates.split(",").map((s) => s.trim()).filter(Boolean);
    if (em.length && emirate && !em.includes(emirate)) return false;
    if (r.expressOnly && !allExpress) return false;
    if (subtotal < r.minOrder) return false;
    if (r.maxOrder != null && subtotal > r.maxOrder) return false;
    return true;
  });
}

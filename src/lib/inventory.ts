// Shared helpers for variant availability.
export type StockLike = { stock: number; trackInventory: boolean; continueSelling: boolean };

export function isAvailable(v: StockLike) {
  return !v.trackInventory || v.continueSelling || v.stock > 0;
}
export function maxQty(v: StockLike, cap = 10) {
  return !v.trackInventory || v.continueSelling ? cap : Math.max(0, Math.min(cap, v.stock));
}

type OptV = { option1: string | null; option2: string | null; option3: string | null; price: number };
/**
 * Reference "new" price for a variant: the Brand New variant with the same other options (e.g. same capacity),
 * else the product's priceNew. Prevents comparing a 1TB renewed price against a 2TB new price.
 */
export function newPriceFor(v: OptV, variants: OptV[], priceNew: number, conditionIndex = 0) {
  const keys = ["option1", "option2", "option3"] as const;
  const match = variants.find((x) => x[keys[conditionIndex]] === "Brand New" && keys.every((k, i) => i === conditionIndex || x[k] === v[k]));
  if (match && match !== v) return match.price;
  if (match === v) return Math.max(priceNew, v.price);
  return priceNew;
}

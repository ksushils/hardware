export const CONDITIONS = {
  NEW: { label: "Brand New", short: "New", desc: "Sealed box, full manufacturer warranty.", color: "bg-blue-100 text-blue-800" },
  EXCELLENT: { label: "Excellent", short: "Excellent", desc: "Like new. No visible signs of use, fully tested.", color: "bg-emerald-100 text-emerald-800" },
  VERY_GOOD: { label: "Very Good", short: "Very Good", desc: "Light signs of use, invisible when installed. Fully tested.", color: "bg-lime-100 text-lime-800" },
  GOOD: { label: "Good", short: "Good", desc: "Visible cosmetic wear. 100% functional, the best value.", color: "bg-amber-100 text-amber-800" },
} as const;
export type Condition = keyof typeof CONDITIONS;
export const CONDITION_ORDER: Condition[] = ["NEW", "EXCELLENT", "VERY_GOOD", "GOOD"];

export function conditionLabel(c: string) {
  return CONDITIONS[c as Condition]?.label ?? c;
}

export function aed(n: number) {
  return "AED " + n.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function pctOff(price: number, ref: number) {
  if (!ref || ref <= price) return 0;
  return Math.round(((ref - price) / ref) * 100);
}

export const EMIRATES = ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"];

export const ORDER_STATUSES = ["PENDING", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"];

export function parseSpecs(s: string): Record<string, string> {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

// Shared (server + client) formatting helpers.
export const CONDITION_VALUES = ["Brand New", "Excellent", "Very Good", "Good"] as const;
export const CONDITION_INFO: Record<string, { color: string }> = {
  "Brand New": { color: "bg-blue-100 text-blue-800" },
  Excellent: { color: "bg-emerald-100 text-emerald-800" },
  "Very Good": { color: "bg-lime-100 text-lime-800" },
  Good: { color: "bg-amber-100 text-amber-800" },
};

export function aed(n: number, locale: string = "en") {
  const num = n.toLocaleString(locale === "ar" ? "ar-AE-u-nu-latn" : "en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return locale === "ar" ? `${num} د.إ` : `AED ${num}`;
}

export function pctOff(price: number, ref: number) {
  if (!ref || ref <= price) return 0;
  return Math.round(((ref - price) / ref) * 100);
}

export const EMIRATES = ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"];
export const EMIRATES_AR: Record<string, string> = {
  Dubai: "دبي", "Abu Dhabi": "أبوظبي", Sharjah: "الشارقة", Ajman: "عجمان", "Umm Al Quwain": "أم القيوين", "Ras Al Khaimah": "رأس الخيمة", Fujairah: "الفجيرة",
};

export const PAYMENT_STATUSES = ["PENDING", "PAID", "PARTIALLY_REFUNDED", "REFUNDED", "FAILED", "VOIDED"];
export const FULFILLMENT_STATUSES = ["UNFULFILLED", "FULFILLED", "DELIVERED", "RETURNED"];
export const ORDER_STATUSES = ["DRAFT", "OPEN", "CANCELLED", "ARCHIVED"];

export function parseSpecs(s: string): Record<string, string> {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
export function parseValues(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}
export function csv(s: string | null | undefined) {
  return (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
}
export function slugify(s: string) {
  return s.toLowerCase().replace(/["']/g, "").replace(/[^a-z0-9؀-ۿ]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
}
export function loc(locale: string, en: string, ar?: string | null) {
  return locale === "ar" && ar ? ar : en;
}

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { siteUrl } from "./site";

// Signed per-order access key so emailed links (invoices, shipping updates) work for guests on any device.
export function orderAccessKey(number: string) {
  return createHmac("sha256", process.env.AUTH_SECRET || "dev-secret-change-me-please-0123456789").update(`order:${number}`).digest("hex").slice(0, 24);
}
export function verifyOrderKey(number: string, key: string | null | undefined) {
  if (!key) return false;
  const a = Buffer.from(orderAccessKey(number)), b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function orderUrl(number: string) {
  return `${siteUrl()}/order/${number}?k=${orderAccessKey(number)}`;
}

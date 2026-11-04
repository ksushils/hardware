import "server-only";
import { headers } from "next/headers";

// In-memory sliding-window limiter (single PM2 instance). Swap for Redis if you scale to several instances.
const hits = new Map<string, number[]>();
let lastSweep = 0;

export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

/** Returns true if the action is allowed, false when `limit` calls per `windowSec` were exceeded for this key. */
export function rateLimit(key: string, limit: number, windowSec: number) {
  const now = Date.now();
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [k, v] of hits) if (!v.some((t) => now - t < 3600_000)) hits.delete(k);
  }
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowSec * 1000);
  if (recent.length >= limit) { hits.set(key, recent); return false; }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

/** Convenience: limit per client IP (and optionally per identifier such as an email). */
export async function limitByIp(action: string, limit: number, windowSec: number, id?: string) {
  const ip = await clientIp();
  return rateLimit(`${action}:${ip}`, limit, windowSec) && (id ? rateLimit(`${action}:id:${id.toLowerCase()}`, limit, windowSec) : true);
}

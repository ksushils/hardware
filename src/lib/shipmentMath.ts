// Pure shipment maths shared by the server (authoritative) and the checkout form (live preview).
// One cart can ship as several parcels: one from the store (delivery rate chosen by the buyer) and one per marketplace seller.
// Never promise a single delivery date for parcels that ship separately: each shipment has its own fee and ETA.
import { lineTotal, type PricingConfig, DEFAULT_PRICING } from "./pricing";

export type ShipItem = { sellerId: string | null; price: number; quantity: number; warranty: boolean; handlingDays: number; express: boolean };
export type SellerShipInfo = { id: string; name: string; flatFee: number; freeOver: number | null };
export type StoreRate = { id: string; name: string; nameAr: string; price: number; freeAbove: number | null; deliveryDays: string; expressOnly: boolean };
export type CarrierWindow = { min: number; max: number };
export const DEFAULT_CARRIER_WINDOW: CarrierWindow = { min: 1, max: 3 };

export type Shipment = {
  key: string; // "store" or the seller id
  kind: "STORE" | "SELLER";
  sellerId: string | null;
  sellerName: string | null;
  itemIndexes: number[]; // indexes into the items array passed to buildShipments
  subtotal: number; // VAT-inclusive value of the items in this shipment (incl. Care+)
  fee: number;
  etaMin: number | null;
  etaMax: number | null;
  express: boolean; // every item express-eligible (store shipments only)
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** "2-4" → [2,4], "1" → [1,1], "0" → [0,0] (same day). Falls back to 2–4. */
export function parseDeliveryDays(d: string | null | undefined): [number, number] {
  const m = String(d ?? "").trim().match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/);
  if (!m) return [2, 4];
  const a = Number(m[1]);
  const b = m[2] != null ? Number(m[2]) : a;
  return [Math.min(a, b), Math.max(a, b)];
}

export function sellerEta(handlingDays: number, win: CarrierWindow): [number, number] {
  const h = Math.max(0, Math.round(handlingDays));
  return [h + win.min, h + win.max];
}

/**
 * Groups items into shipments and prices each one.
 * - Store shipment: the chosen ShippingRate (free above its threshold, judged on the store group's value after its pro-rata share of any discount).
 * - Seller shipment: the seller's flat fee, free when the seller's group value (before discounts) reaches their free-shipping threshold.
 * - A FREE_SHIPPING discount makes every fee zero.
 * Shipments are ordered: store first, then sellers by name, so "Shipment i of N" numbering is stable.
 */
export function buildShipments(
  items: ShipItem[],
  sellers: Record<string, SellerShipInfo>,
  opts: { cfg?: PricingConfig; carrier?: CarrierWindow; rate?: StoreRate | null; discount?: number; freeShipping?: boolean } = {},
): Shipment[] {
  const cfg = opts.cfg ?? DEFAULT_PRICING;
  const carrier = opts.carrier ?? DEFAULT_CARRIER_WINDOW;
  const groups = new Map<string, number[]>();
  items.forEach((it, i) => {
    const k = it.sellerId ?? "store";
    groups.set(k, [...(groups.get(k) ?? []), i]);
  });
  const total = round2(items.reduce((s, it) => s + lineTotal(it, cfg), 0));
  const discount = Math.min(opts.discount ?? 0, total);
  const share = total > 0 ? (total - discount) / total : 1;

  const out: Shipment[] = [];
  for (const [key, idx] of groups) {
    const sub = round2(idx.reduce((s, i) => s + lineTotal(items[i], cfg), 0));
    if (key === "store") {
      const rate = opts.rate ?? null;
      const free = opts.freeShipping || (rate?.freeAbove != null && round2(sub * share) >= rate.freeAbove);
      const [a, b] = rate ? parseDeliveryDays(rate.deliveryDays) : [null, null];
      out.push({ key, kind: "STORE", sellerId: null, sellerName: null, itemIndexes: idx, subtotal: sub, fee: rate && !free ? rate.price : 0, etaMin: a, etaMax: b, express: idx.every((i) => items[i].express) });
    } else {
      const sel = sellers[key];
      const handling = Math.max(0, ...idx.map((i) => items[i].handlingDays));
      const [a, b] = sellerEta(handling, carrier);
      const free = opts.freeShipping || (sel?.freeOver != null && sub >= sel.freeOver);
      out.push({ key, kind: "SELLER", sellerId: key, sellerName: sel?.name ?? "Seller", itemIndexes: idx, subtotal: sub, fee: free ? 0 : round2(sel?.flatFee ?? 0), etaMin: a, etaMax: b, express: false });
    }
  }
  return out.sort((x, y) => (x.kind === y.kind ? (x.sellerName ?? "").localeCompare(y.sellerName ?? "") : x.kind === "STORE" ? -1 : 1));
}

/** Human ETA, bilingual. "arrives in 3–5 business days" / "same day" / "next business day". */
export function etaText(min: number | null, max: number | null, locale: "en" | "ar"): string {
  if (min == null || max == null) return "";
  const ar = locale === "ar";
  if (max === 0) return ar ? "في نفس اليوم" : "same day";
  if (min === 1 && max === 1) return ar ? "يوم العمل التالي" : "next business day";
  const range = min === max ? String(min) : `${min}–${max}`;
  return ar ? `${range} أيام عمل` : `${range} business days`;
}

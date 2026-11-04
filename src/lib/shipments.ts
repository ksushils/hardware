import "server-only";
import type { Order, OrderItem } from "@prisma/client";
import { db } from "./db";
import { isAvailable } from "./inventory";
import { sellerAllowsSales } from "./marketplace";
import { parseDeliveryDays, type SellerShipInfo } from "./shipmentMath";
import type { CartEntry, getCartDetails } from "./cart";

type CartItem = Awaited<ReturnType<typeof getCartDetails>>["items"][number];

export type BlockedLine = { variantId: string; name: string; reason: "OFFER_HIDDEN" | "OUT_OF_STOCK" | "REMOVED" };

/**
 * Splits cart lines into those that may be bought and those that may not (offer hidden by moderation, seller suspended/on vacation,
 * out of stock, deleted). Used by the cart page, the checkout page and placeOrder so all three agree.
 * Seller identity comes from the offer (variant.sellerId); null = sold by the store.
 */
export async function resolveCheckoutCart(items: CartItem[], entries: CartEntry[]) {
  const sellerIds = [...new Set(items.map((i) => i.variant.sellerId).filter((x): x is string => !!x))];
  const sellerRows = sellerIds.length
    ? await db.seller.findMany({ where: { id: { in: sellerIds } }, select: { id: true, shopName: true, slug: true, status: true, vacationMode: true, vacationUntil: true, flatShippingFee: true, freeShippingOver: true } })
    : [];
  const sellerById = new Map(sellerRows.map((s) => [s.id, s]));

  const ok: CartItem[] = [];
  const blocked: BlockedLine[] = [];
  for (const i of items) {
    const seller = i.variant.sellerId ? sellerById.get(i.variant.sellerId) : null;
    const hidden =
      i.variant.approvalStatus !== "APPROVED" ||
      i.product.status !== "ACTIVE" ||
      i.product.approvalStatus !== "APPROVED" ||
      (i.variant.sellerId != null && (!seller || !sellerAllowsSales(seller)));
    if (hidden) blocked.push({ variantId: i.variant.id, name: `${i.product.brand} ${i.product.name}`, reason: "OFFER_HIDDEN" });
    else ok.push(i);
  }

  // entries getCartDetails already dropped (deleted, unapproved, out of stock…)
  const missing = entries.filter((e) => !items.some((i) => i.variant.id === e.v));
  if (missing.length) {
    const rows = await db.variant.findMany({ where: { id: { in: missing.map((m) => m.v) } }, include: { product: true } });
    for (const e of missing) {
      const v = rows.find((r) => r.id === e.v);
      if (!v) blocked.push({ variantId: e.v, name: "Unavailable item", reason: "REMOVED" });
      else blocked.push({ variantId: e.v, name: `${v.product.brand} ${v.product.name}`, reason: isAvailable(v) ? "OFFER_HIDDEN" : "OUT_OF_STOCK" });
    }
  }

  const sellers: Record<string, SellerShipInfo> = {};
  for (const i of ok) {
    const id = i.variant.sellerId;
    const s = id ? sellerById.get(id) : null;
    if (id && s && !sellers[id]) sellers[id] = { id, name: s.shopName, flatFee: s.flatShippingFee, freeOver: s.freeShippingOver };
  }
  return { items: ok, blocked, sellers };
}

export function blockedMessage(b: BlockedLine[], ar: boolean) {
  const names = b.map((x) => x.name).join(", ");
  return ar
    ? `لم تعد هذه المنتجات متاحة، يرجى إزالتها من سلتك: ${names}`
    : `These items are no longer available. Please remove them from your cart: ${names}`;
}

// ───────────────────────── order display ─────────────────────────

export type OrderShipment = {
  index: number;
  total: number;
  kind: "STORE" | "SELLER";
  sellerName: string | null;
  items: OrderItem[];
  fee: number;
  etaMin: number | null;
  etaMax: number | null;
  status: string; // store: derived from the order; seller: SellerOrder.status
  trackingCompany: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
};

/**
 * Shipments of a placed order for display (order page, emails): the store parcel (items sold by the store) plus one per seller sub-order.
 * Store ETA is looked up from the delivery rate the buyer chose (rates are matched by name).
 */
export async function describeShipments(order: Order & { items: OrderItem[] }): Promise<OrderShipment[]> {
  const sellerOrders = await db.sellerOrder.findMany({ where: { orderId: order.id }, include: { seller: { select: { shopName: true } } }, orderBy: { createdAt: "asc" } });
  const storeItems = order.items.filter((i) => !i.sellerOrderId);
  const sellerFees = sellerOrders.reduce((s, so) => s + so.shippingFee, 0);
  const list: Omit<OrderShipment, "index" | "total">[] = [];
  if (storeItems.length || !sellerOrders.length) {
    const rate = storeItems.length ? await db.shippingRate.findFirst({ where: { name: order.shippingRateName } }) : null;
    const [a, b] = rate ? parseDeliveryDays(rate.deliveryDays) : [null, null];
    list.push({
      kind: "STORE", sellerName: null, items: sellerOrders.length ? storeItems : order.items, fee: Math.max(0, Math.round((order.shipping - sellerFees) * 100) / 100),
      etaMin: a, etaMax: b,
      status: order.status === "CANCELLED" ? "CANCELLED" : order.fulfillmentStatus === "DELIVERED" ? "DELIVERED" : order.fulfillmentStatus === "FULFILLED" ? "SHIPPED" : "PENDING",
      trackingCompany: order.trackingCompany, trackingNumber: order.trackingNumber, trackingUrl: order.trackingUrl,
    });
  }
  for (const so of sellerOrders) {
    list.push({
      kind: "SELLER", sellerName: so.seller.shopName, items: order.items.filter((i) => i.sellerOrderId === so.id), fee: so.shippingFee, etaMin: so.etaMinDays, etaMax: so.etaMaxDays,
      status: so.status, trackingCompany: so.trackingCompany, trackingNumber: so.trackingNumber, trackingUrl: null,
    });
  }
  return list.map((s, i) => ({ ...s, index: i + 1, total: list.length }));
}

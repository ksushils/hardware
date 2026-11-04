import "server-only";
import type { Order, OrderItem } from "@prisma/client";
import { db } from "./db";
import { getSettings } from "./settings";

export type Commission = { type: string; percent: number; fixed: number };

/** Resolves the commission for a product: seller override > PRODUCT rule > SELLER rule > CATEGORY rule > GLOBAL rule > settings default. */
export async function resolveCommission(p: { id: string; categoryId: string; sellerId: string | null }): Promise<Commission> {
  const s = await getSettings();
  const fallback = { type: "PERCENT", percent: s.marketplace.defaultCommissionPercent, fixed: 0 };
  if (!p.sellerId) return { type: "NONE", percent: 0, fixed: 0 };
  const seller = await db.seller.findUnique({ where: { id: p.sellerId } });
  if (seller?.commissionType) return { type: seller.commissionType, percent: seller.commissionRate ?? 0, fixed: seller.commissionFixed ?? 0 };
  const rules = await db.commissionRule.findMany({ where: { active: true } });
  const pick =
    rules.find((r) => r.scope === "PRODUCT" && r.productId === p.id) ??
    rules.find((r) => r.scope === "SELLER" && r.sellerId === p.sellerId) ??
    rules.find((r) => r.scope === "CATEGORY" && r.categoryId === p.categoryId) ??
    rules.find((r) => r.scope === "GLOBAL");
  return pick ? { type: pick.type, percent: pick.percent, fixed: pick.fixed } : fallback;
}

/** Commission on a line, taken from the VAT-inclusive line price (Care+ warranty revenue stays with the store). */
export function commissionFor(c: Commission, unitPrice: number, qty: number) {
  const gross = unitPrice * qty;
  let amount = 0;
  if (c.type === "PERCENT") amount = gross * (c.percent / 100);
  else if (c.type === "FIXED") amount = c.fixed * qty;
  else if (c.type === "FIXED_PERCENT") amount = c.fixed * qty + gross * (c.percent / 100);
  amount = Math.min(gross, Math.round(amount * 100) / 100);
  return { amount, earning: Math.round((gross - amount) * 100) / 100 };
}

export type SellerShipmentMeta = { shippingFee: number; etaMinDays: number | null; etaMaxDays: number | null };

/**
 * Splits an order into per-seller sub-orders (one shipment per seller) and snapshots commission on each line.
 * The seller of a line is the seller of the OFFER (variant.sellerId), recorded on the order item at checkout;
 * product.sellerId is only the product's creator and is never used to attribute sales.
 * Store-owned items (no seller) are left alone. Earnings are credited to the ledger on delivery (see creditSellerEarnings).
 * `shipments` carries each seller shipment's delivery fee and ETA computed at checkout (see lib/shipmentMath.ts).
 */
export async function createSellerOrders(order: Order & { items: OrderItem[] }, shipments?: Map<string, SellerShipmentMeta>) {
  const productIds = order.items.map((i) => i.productId).filter((x): x is string => !!x);
  const variantIds = order.items.map((i) => i.variantId).filter((x): x is string => !!x);
  const [products, variants] = await Promise.all([
    db.product.findMany({ where: { id: { in: productIds } }, select: { id: true, categoryId: true } }),
    db.variant.findMany({ where: { id: { in: variantIds } }, select: { id: true, sellerId: true } }),
  ]);
  const bySeller = new Map<string, { item: OrderItem; c: ReturnType<typeof commissionFor>; comm: Commission }[]>();
  for (const item of order.items) {
    const p = products.find((x) => x.id === item.productId);
    const sellerId = item.sellerId ?? variants.find((v) => v.id === item.variantId)?.sellerId ?? null;
    if (!p || !sellerId) continue;
    const comm = await resolveCommission({ id: p.id, categoryId: p.categoryId, sellerId });
    const c = commissionFor(comm, item.price, item.quantity);
    bySeller.set(sellerId, [...(bySeller.get(sellerId) ?? []), { item, c, comm }]);
  }
  for (const [sellerId, lines] of bySeller) {
    const ship = shipments?.get(sellerId);
    const so = await db.sellerOrder.create({
      data: {
        orderId: order.id, sellerId,
        subtotal: lines.reduce((s, l) => s + l.item.price * l.item.quantity, 0),
        commissionTotal: lines.reduce((s, l) => s + l.c.amount, 0),
        sellerEarning: lines.reduce((s, l) => s + l.c.earning, 0),
        shippingFee: ship?.shippingFee ?? 0, etaMinDays: ship?.etaMinDays ?? null, etaMaxDays: ship?.etaMaxDays ?? null,
      },
    });
    for (const l of lines)
      await db.orderItem.update({
        where: { id: l.item.id },
        data: { sellerId, sellerOrderId: so.id, commissionRate: l.comm.percent, commissionFixed: l.comm.fixed, commissionAmount: l.c.amount, sellerEarning: l.c.earning },
      });
  }
}

/** Credits a delivered sub-order's earnings to the seller ledger (available after the hold period). Idempotent. */
export async function creditSellerEarnings(sellerOrderId: string) {
  const so = await db.sellerOrder.findUnique({ where: { id: sellerOrderId }, include: { order: true } });
  if (!so) return;
  const exists = await db.sellerTransaction.findFirst({ where: { sellerOrderId, type: "EARNING" } });
  if (exists) return;
  const s = await getSettings();
  await db.sellerTransaction.create({
    // the seller's own delivery fee is part of what we owe them (the ledger accrues it too), so it is credited with the earning
    data: { sellerId: so.sellerId, type: "EARNING", amount: Math.round((so.sellerEarning + (so.shippingFee ?? 0)) * 100) / 100, sellerOrderId, availableAt: new Date(Date.now() + s.marketplace.holdDays * 86400_000), note: `Order ${so.order.number}` },
  });
}

export async function sellerBalance(sellerId: string) {
  const now = new Date();
  const [all, available] = await Promise.all([
    db.sellerTransaction.aggregate({ where: { sellerId }, _sum: { amount: true } }),
    db.sellerTransaction.aggregate({ where: { sellerId, availableAt: { lte: now } }, _sum: { amount: true } }),
  ]);
  const pendingPayouts = await db.payout.aggregate({ where: { sellerId, status: { in: ["REQUESTED", "APPROVED"] } }, _sum: { amount: true } });
  const avail = (available._sum.amount ?? 0) - (pendingPayouts._sum.amount ?? 0);
  return { total: all._sum.amount ?? 0, available: Math.max(0, Math.round(avail * 100) / 100), pending: Math.round(((all._sum.amount ?? 0) - (available._sum.amount ?? 0)) * 100) / 100, requested: pendingPayouts._sum.amount ?? 0 };
}

/** A product is purchasable only if its seller (if any) is approved and not on vacation. */
export function sellerAllowsSales(seller: { status: string; vacationMode: boolean; vacationUntil?: Date | null } | null | undefined) {
  if (!seller) return true;
  if (seller.status !== "APPROVED") return false;
  // vacation ends automatically once vacationUntil has passed
  const onVacation = seller.vacationMode && (!seller.vacationUntil || seller.vacationUntil > new Date());
  return !onVacation;
}

/** When the whole order is delivered (admin action), deliver its seller sub-orders and credit earnings. */
export async function deliverSellerOrdersForOrder(orderId: string) {
  const subs = await db.sellerOrder.findMany({ where: { orderId, status: { notIn: ["CANCELLED", "REFUNDED"] } } });
  for (const so of subs) {
    if (so.status !== "DELIVERED") await db.sellerOrder.update({ where: { id: so.id }, data: { status: "DELIVERED", deliveredAt: new Date() } });
    await creditSellerEarnings(so.id);
  }
}

/**
 * On a refund of `amount` (AED) against an order, debit each seller proportionally to their share of the
 * order's merchandise value — only for sub-orders whose earnings were already credited.
 */
export async function applySellerRefund(orderId: string, amount: number, onlySellerId?: string) {
  if (amount <= 0) return;
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true, sellerOrders: true } });
  if (!order || !order.sellerOrders.length) return;
  const merch = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
  if (merch <= 0) return;
  for (const so of order.sellerOrders) {
    // support cases refund one seller's item: debit only that seller, against their own sub-order (share = 100% of this refund)
    if (onlySellerId && so.sellerId !== onlySellerId) continue;
    const credited = await db.sellerTransaction.findFirst({ where: { sellerOrderId: so.id, type: "EARNING" } });
    if (!credited) continue;
    const earningRatio = so.subtotal > 0 ? so.sellerEarning / so.subtotal : 0;
    const debit = onlySellerId
      ? Math.round(Math.min(amount, so.subtotal) * earningRatio * 100) / 100
      : Math.round(Math.min(amount, order.total) * (so.subtotal / merch) * earningRatio * 100) / 100;
    if (debit > 0) await db.sellerTransaction.create({ data: { sellerId: so.sellerId, type: "REFUND", amount: -debit, sellerOrderId: so.id, note: `Refund on order ${order.number}` } });
  }
}

export async function recomputeSellerRating(sellerId: string) {
  const agg = await db.sellerReview.aggregate({ where: { sellerId, status: "PUBLISHED" }, _avg: { rating: true }, _count: true });
  await db.seller.update({ where: { id: sellerId }, data: { ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10, ratingCount: agg._count } });
}

export function slugifyShop(s: string) {
  return s.toLowerCase().replace(/["']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);
}
export const RESERVED_SLUGS = ["admin", "seller", "sellers", "new", "apply", "techrevive", "store", "official", "support"];

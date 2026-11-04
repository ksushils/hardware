import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type Range = { from: Date; to: Date; key: string; label: string };

/** Parses ?range=today|7|30|90|365|custom&from=YYYY-MM-DD&to=YYYY-MM-DD */
export function parseRange(sp: { range?: string; from?: string; to?: string }, def = "30"): Range {
  const key = sp.range ?? def;
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  if (key === "custom" && sp.from) {
    const from = new Date(sp.from + "T00:00:00");
    const to = sp.to ? new Date(sp.to + "T23:59:59.999") : end;
    if (!isNaN(+from) && !isNaN(+to) && from <= to) return { from, to, key, label: `${sp.from} → ${sp.to ?? "today"}` };
  }
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (key === "today") return { from: start, to: end, key, label: "Today" };
  const days = [7, 30, 90, 365].includes(Number(key)) ? Number(key) : Number(def);
  start.setDate(start.getDate() - (days - 1));
  return { from: start, to: end, key: String(days), label: `Last ${days} days` };
}

/** Orders that count as sales: not draft/cancelled, and either paid/refunded or pay-on-delivery/manual. */
export function salesWhere(r: Range): Prisma.OrderWhereInput {
  return {
    createdAt: { gte: r.from, lte: r.to },
    status: { notIn: ["DRAFT", "CANCELLED"] },
    OR: [{ paymentStatus: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] } }, { paymentMethod: { in: ["COD", "MANUAL"] }, paymentStatus: { notIn: ["FAILED", "VOIDED"] } }],
  };
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export function buckets(r: Range) {
  const days = Math.ceil((+r.to - +r.from) / 86400000);
  const monthly = days > 92;
  const keys: string[] = [];
  const d = new Date(r.from);
  if (monthly) {
    d.setDate(1);
    while (d <= r.to) { keys.push(monthKey(d)); d.setMonth(d.getMonth() + 1); }
  } else {
    while (d <= r.to) { keys.push(dayKey(d)); d.setDate(d.getDate() + 1); }
  }
  return { keys, keyOf: monthly ? monthKey : dayKey, monthly };
}

export type Row = { label: string; orders: number; units: number; sales: number; extra?: string };

export async function getAnalytics(r: Range) {
  const orders = await db.order.findMany({ where: salesWhere(r), include: { items: true }, orderBy: { createdAt: "asc" } });
  const productIds = [...new Set(orders.flatMap((o) => o.items.map((i) => i.productId).filter((x): x is string => !!x)))];
  const products = await db.product.findMany({ where: { id: { in: productIds } }, select: { id: true, brand: true, category: { select: { name: true } } } });
  const pmap = new Map(products.map((p) => [p.id, p]));

  let gross = 0, discounts = 0, refunds = 0, shipping = 0, vat = 0, units = 0, revenueWithCost = 0, cost = 0, giftCards = 0;
  const byProduct = new Map<string, Row>(), byCategory = new Map<string, Row>(), byVendor = new Map<string, Row>();
  const byEmirate = new Map<string, Row>(), byPayment = new Map<string, Row>(), byCustomer = new Map<string, Row>(), byCode = new Map<string, Row>();
  const add = (m: Map<string, Row>, label: string, sales: number, u: number, newOrder: boolean, extra?: string) => {
    const row = m.get(label) ?? { label, orders: 0, units: 0, sales: 0, extra };
    row.sales += sales; row.units += u; if (newOrder) row.orders += 1;
    m.set(label, row);
  };
  const { keys, keyOf, monthly } = buckets(r);
  const salesSeries = new Map(keys.map((k) => [k, 0]));
  const orderSeries = new Map(keys.map((k) => [k, 0]));

  for (const o of orders) {
    gross += o.subtotal; discounts += o.discount; refunds += o.refundedAmount; shipping += o.shipping + o.codFee; vat += o.vat; giftCards += o.giftCardAmount;
    const orderNet = o.subtotal - o.discount - o.refundedAmount + o.shipping + o.codFee;
    const k = keyOf(o.createdAt);
    salesSeries.set(k, (salesSeries.get(k) ?? 0) + orderNet);
    orderSeries.set(k, (orderSeries.get(k) ?? 0) + 1);
    const seen = { cat: new Set<string>(), ven: new Set<string>(), prod: new Set<string>() };
    for (const i of o.items) {
      const line = (i.price + i.warrantyPrice) * i.quantity;
      units += i.quantity;
      if (i.cost != null) { revenueWithCost += i.price * i.quantity; cost += i.cost * i.quantity; }
      const p = i.productId ? pmap.get(i.productId) : undefined;
      const cat = p?.category.name ?? "Uncategorised", ven = p?.brand ?? "Unknown";
      add(byProduct, i.name, line, i.quantity, !seen.prod.has(i.name)); seen.prod.add(i.name);
      add(byCategory, cat, line, i.quantity, !seen.cat.has(cat)); seen.cat.add(cat);
      add(byVendor, ven, line, i.quantity, !seen.ven.has(ven)); seen.ven.add(ven);
    }
    const u = o.items.reduce((s, i) => s + i.quantity, 0);
    add(byEmirate, o.emirate, orderNet, u, true);
    add(byPayment, o.paymentMethod, orderNet, u, true);
    add(byCustomer, o.email, orderNet, u, true, o.fullName);
    if (o.discountCode || o.discountTitle) {
      const row = byCode.get(o.discountCode ?? o.discountTitle!) ?? { label: o.discountCode ?? o.discountTitle!, orders: 0, units: 0, sales: 0, extra: "0" };
      row.orders += 1; row.sales += orderNet; row.extra = String(r2(Number(row.extra) + o.discount));
      byCode.set(row.label, row);
    }
  }

  // returning customers: customers in range who have more than one (non-cancelled, non-draft) order ever
  const emails = [...byCustomer.keys()];
  let returning = 0;
  if (emails.length) {
    const counts = await db.order.groupBy({ by: ["email"], where: { email: { in: emails }, status: { notIn: ["DRAFT", "CANCELLED"] } }, _count: { _all: true } });
    returning = counts.filter((c) => c._count._all > 1).length;
  }

  const net = gross - discounts - refunds;
  const sort = (m: Map<string, Row>) => [...m.values()].map((x) => ({ ...x, sales: r2(x.sales) })).sort((a, b) => b.sales - a.sales);
  const fmtLabel = (k: string) => {
    if (monthly) { const [y, m] = k.split("-"); return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-AE", { month: "short", year: "2-digit" }); }
    const [y, m, d] = k.split("-"); return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-AE", { day: "numeric", month: "short" });
  };
  return {
    kpi: {
      gross: r2(gross), discounts: r2(discounts), refunds: r2(refunds), net: r2(net), shipping: r2(shipping), vat: r2(vat),
      total: r2(net + shipping), orders: orders.length, aov: orders.length ? r2((gross - discounts + shipping) / orders.length) : 0,
      units, grossProfit: r2(revenueWithCost - cost), margin: revenueWithCost ? Math.round(((revenueWithCost - cost) / revenueWithCost) * 100) : 0,
      customers: emails.length, returning, returningRate: emails.length ? Math.round((returning / emails.length) * 100) : 0, giftCards: r2(giftCards),
    },
    salesSeries: keys.map((k) => ({ label: fmtLabel(k), value: r2(salesSeries.get(k) ?? 0) })),
    orderSeries: keys.map((k) => ({ label: fmtLabel(k), value: orderSeries.get(k) ?? 0 })),
    tables: {
      products: sort(byProduct), categories: sort(byCategory), vendors: sort(byVendor), emirates: sort(byEmirate),
      payments: sort(byPayment), customers: sort(byCustomer), discounts: sort(byCode),
    },
  };
}

export const TABLES = {
  products: { title: "Sales by product", label: "Product" },
  categories: { title: "Sales by category", label: "Category" },
  vendors: { title: "Sales by vendor", label: "Vendor" },
  emirates: { title: "Sales by emirate", label: "Emirate" },
  payments: { title: "Sales by payment method", label: "Payment method" },
  customers: { title: "Top customers", label: "Customer" },
  discounts: { title: "Discount code usage", label: "Code" },
} as const;
export type TableKey = keyof typeof TABLES;

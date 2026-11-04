import "server-only";
import { db } from "@/lib/db";
import type { Discount } from "@prisma/client";
import type { DiscountInitial } from "./DiscountForm";

export async function discountOptions() {
  const [products, collections] = await Promise.all([
    db.product.findMany({ where: { status: { not: "ARCHIVED" } }, select: { id: true, name: true, brand: true }, orderBy: { name: "asc" } }),
    db.collection.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);
  return { products: products.map((p) => ({ id: p.id, label: `${p.brand} ${p.name}` })), collections: collections.map((c) => ({ id: c.id, label: c.title })) };
}

const local = (d: Date | null) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

export function toInitial(d?: Discount): DiscountInitial {
  if (!d)
    return { title: "", code: "", method: "CODE", type: "PERCENT", value: 10, appliesTo: "ALL", targetIds: [], minType: "NONE", minValue: 0, buyQty: 1, getQty: 1, usageLimit: "", oncePerCustomer: false, startsAt: local(new Date()), endsAt: "", active: true, usedCount: 0 };
  return {
    id: d.id, title: d.title, code: d.code ?? "", method: d.method, type: d.type, value: d.value, appliesTo: d.appliesTo, targetIds: d.targetIds.split(",").filter(Boolean),
    minType: d.minType, minValue: d.minValue, buyQty: d.buyQty ?? 1, getQty: d.getQty ?? 1, usageLimit: d.usageLimit ? String(d.usageLimit) : "",
    oncePerCustomer: d.oncePerCustomer, startsAt: local(d.startsAt), endsAt: local(d.endsAt), active: d.active, usedCount: d.usedCount,
  };
}

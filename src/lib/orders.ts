import "server-only";
import { cookies } from "next/headers";
import { db } from "./db";
import { getUser } from "./auth";

const COOKIE = "tr_orders";

export function newOrderNumber() {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `TR${ymd}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

/** Remember guest orders in this browser so the guest can view them. */
export async function rememberOrder(number: string) {
  const jar = await cookies();
  const list = (jar.get(COOKIE)?.value || "").split(",").filter(Boolean);
  list.unshift(number);
  jar.set(COOKIE, list.slice(0, 20).join(","), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 90 });
}

export async function canViewOrder(order: { number: string; userId: string | null }) {
  const user = await getUser();
  if (user && (user.role === "ADMIN" || user.id === order.userId)) return true;
  const list = ((await cookies()).get(COOKIE)?.value || "").split(",");
  return list.includes(order.number);
}

export async function getOrder(number: string) {
  return db.order.findUnique({ where: { number }, include: { items: true } });
}

/** Restores stock when an order is cancelled. */
export async function restock(orderId: string) {
  const items = await db.orderItem.findMany({ where: { orderId } });
  await db.$transaction(items.map((i) => db.variant.update({ where: { id: i.variantId }, data: { stock: { increment: i.quantity } } })));
}

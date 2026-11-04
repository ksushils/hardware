import "server-only";
import { db } from "@/lib/db";

/** Orders count + total spent per user id (excludes drafts & cancelled; net of refunds). */
export async function customerStats(userIds: string[]) {
  const rows = await db.order.groupBy({
    by: ["userId"],
    where: { userId: { in: userIds }, status: { notIn: ["DRAFT", "CANCELLED"] } },
    _count: true,
    _sum: { total: true, refundedAmount: true },
  });
  const map = new Map<string, { orders: number; spent: number }>();
  for (const r of rows) if (r.userId) map.set(r.userId, { orders: r._count, spent: (r._sum.total ?? 0) - (r._sum.refundedAmount ?? 0) });
  return map;
}

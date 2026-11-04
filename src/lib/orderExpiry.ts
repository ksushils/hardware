import "server-only";
import { db } from "./db";
import { cancelOrderInternal } from "./orders";

/**
 * Releases stock held by card orders that were never paid. Without this, abandoned card checkouts would hold inventory forever.
 * Runs from the cron route (every 10 minutes). Draft orders and COD orders are never touched.
 */
export async function expireUnpaidCardOrders(minutes = 60) {
  const cutoff = new Date(Date.now() - minutes * 60_000);
  const stale = await db.order.findMany({
    where: { status: "OPEN", source: "WEB", paymentMethod: "CARD", paymentStatus: { in: ["PENDING", "FAILED"] }, createdAt: { lt: cutoff }, fulfillmentStatus: "UNFULFILLED" },
    take: 200,
  });
  let released = 0;
  for (const o of stale) {
    // re-check right before cancelling so a payment confirmed a moment ago is never cancelled
    const fresh = await db.order.findUnique({ where: { id: o.id } });
    if (!fresh || fresh.paymentStatus === "PAID" || fresh.status !== "OPEN") continue;
    await cancelOrderInternal(fresh, `Payment not completed within ${minutes} minutes`);
    released++;
  }
  return { checked: stale.length, released };
}

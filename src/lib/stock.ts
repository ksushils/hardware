import "server-only";
import type { Prisma } from "@prisma/client";

export class OutOfStockError extends Error {
  constructor(public label: string, public variantId: string) {
    super(`${label} just went out of stock.`);
    this.name = "OutOfStockError";
  }
}

export type StockLine = { variantId: string; quantity: number; trackInventory: boolean; continueSelling: boolean; label: string };

/**
 * Atomically takes stock for an order inside the caller's transaction.
 * The guard `stock >= quantity` lives in the UPDATE's WHERE clause, so two buyers racing for the last unit cannot both succeed:
 * the loser gets count 0 and the whole order transaction rolls back (nothing is decremented, no adjustment is written).
 * Offers with "continue selling" may oversell by design; untracked offers are never touched.
 */
export async function reserveStock(tx: Prisma.TransactionClient, lines: StockLine[]) {
  for (const l of lines) {
    if (!l.trackInventory) continue;
    if (l.continueSelling) {
      await tx.variant.update({ where: { id: l.variantId }, data: { stock: { decrement: l.quantity } } });
    } else {
      const res = await tx.variant.updateMany({ where: { id: l.variantId, stock: { gte: l.quantity } }, data: { stock: { decrement: l.quantity } } });
      if (res.count === 0) throw new OutOfStockError(l.label, l.variantId);
    }
    await tx.inventoryAdjustment.create({ data: { variantId: l.variantId, delta: -l.quantity, reason: "sold" } });
  }
}

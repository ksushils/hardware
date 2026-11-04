// Idempotent data backfills run by deploy.sh after `prisma db push`.
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  // Offers: variants of seller-created products belong to that seller (marketplace offers model).
  const products = await db.product.findMany({ where: { sellerId: { not: null } }, select: { id: true, sellerId: true, approvalStatus: true } });
  let n = 0;
  for (const p of products) {
    const r = await db.variant.updateMany({ where: { productId: p.id, sellerId: null }, data: { sellerId: p.sellerId, approvalStatus: p.approvalStatus } });
    n += r.count;
  }
  console.log(`backfill: ${n} variants assigned to their seller`);
}
main().finally(() => db.$disconnect());

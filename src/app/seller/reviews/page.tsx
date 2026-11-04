import { db } from "@/lib/db";
import { requireSeller } from "@/lib/sellerAuth";
import { Card, PageHeader, EmptyState } from "@/components/admin/ui";

export const metadata = { title: "Reviews" };

export default async function SellerReviews() {
  const { seller } = await requireSeller();
  const [shopReviews, productReviews] = await Promise.all([
    db.sellerReview.findMany({ where: { sellerId: seller.id, status: "PUBLISHED" }, orderBy: { createdAt: "desc" } }),
    db.review.findMany({ where: { product: { sellerId: seller.id }, status: "PUBLISHED" }, include: { product: { select: { name: true } }, user: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  const users = await db.user.findMany({ where: { id: { in: shopReviews.map((r) => r.userId) } }, select: { id: true, name: true } });
  return (
    <>
      <PageHeader title="Reviews" subtitle={seller.ratingCount ? `Shop rating ★ ${seller.ratingAvg} from ${seller.ratingCount} review(s)` : undefined} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Shop reviews">
          {shopReviews.length ? shopReviews.map((r) => <div key={r.id} className="border-b border-slate-100 py-2 text-sm last:border-0"><span className="text-amber-500">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span> <b>{users.find((u) => u.id === r.userId)?.name}</b><p>{r.comment}</p></div>) : <EmptyState title="No shop reviews yet" />}
        </Card>
        <Card title="Product reviews">
          {productReviews.length ? productReviews.map((r) => <div key={r.id} className="border-b border-slate-100 py-2 text-sm last:border-0"><span className="text-amber-500">{"★".repeat(r.rating)}</span> <b>{r.user.name}</b> on {r.product.name}<p>{r.comment}</p></div>) : <EmptyState title="No product reviews yet" />}
        </Card>
      </div>
    </>
  );
}

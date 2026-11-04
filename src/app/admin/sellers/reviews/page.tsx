import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { Card, PageHeader, StatusBadge, EmptyState } from "@/components/admin/ui";
import Flash from "@/components/marketplace/Flash";
import { moderateSellerReview } from "@/app/actions/admin/sellers";

export const metadata = { title: "Seller reviews" };

export default async function SellerReviewsPage({ searchParams }: { searchParams: Promise<{ msg?: string; error?: string }> }) {
  await requirePermission("sellers");
  const sp = await searchParams;
  const reviews = await db.sellerReview.findMany({ include: { seller: { select: { shopName: true, id: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
  const users = await db.user.findMany({ where: { id: { in: reviews.map((r) => r.userId) } }, select: { id: true, name: true, email: true } });
  return (
    <>
      <PageHeader back="/admin/sellers" title="Seller reviews" />
      <Flash msg={sp.msg} error={sp.error} />
      <Card pad={false}>
        {reviews.length ? (
          <div className="divide-y divide-slate-100">
            {reviews.map((r) => {
              const u = users.find((x) => x.id === r.userId);
              return (
                <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 p-4 text-sm">
                  <div>
                    <p><span className="text-amber-500">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span> · <Link href={`/admin/sellers/${r.seller.id}`} className="font-semibold hover:underline">{r.seller.shopName}</Link> <StatusBadge status={r.status} /></p>
                    <p className="mt-1 text-slate-700">{r.comment}</p>
                    <p className="text-xs text-slate-500">{u?.name} ({u?.email}) · {r.createdAt.toLocaleDateString("en-AE")}</p>
                  </div>
                  <form action={moderateSellerReview} className="flex gap-1">
                    <input type="hidden" name="id" value={r.id} />
                    {r.status !== "PUBLISHED" && <button name="action" value="publish" className="btn-a">Publish</button>}
                    {r.status === "PUBLISHED" && <button name="action" value="hide" className="btn-a">Hide</button>}
                    <button name="action" value="delete" className="btn-a-danger">Delete</button>
                  </form>
                </div>
              );
            })}
          </div>
        ) : <EmptyState title="No seller reviews yet" />}
      </Card>
    </>
  );
}

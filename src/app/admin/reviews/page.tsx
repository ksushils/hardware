import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { Card, EmptyState, PageHeader, Pagination, Stat, StatusBadge, Tabs } from "@/components/admin/ui";
import { AutoSubmitSelect, ConfirmButton } from "@/components/admin/client";
import { bulkReviews, deleteReview, replyReview, setReviewStatus } from "@/app/actions/admin/reviews";

export const metadata = { title: "Reviews" };
const PAGE_SIZE = 20;

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ status?: string; rating?: string; q?: string; page?: string }> }) {
  await requirePermission("products");
  const sp = await searchParams;
  const status = ["PUBLISHED", "PENDING", "HIDDEN"].includes(sp.status ?? "") ? sp.status! : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.ReviewWhereInput = {};
  if (status) where.status = status;
  if (sp.rating) where.rating = Number(sp.rating);
  if (sp.q) where.OR = [{ comment: { contains: sp.q } }, { product: { name: { contains: sp.q } } }, { user: { name: { contains: sp.q } } }];
  const [total, reviews, counts, avg] = await Promise.all([
    db.review.count({ where }),
    db.review.findMany({ where, include: { product: { select: { id: true, name: true, image: true, slug: true } }, user: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.review.groupBy({ by: ["status"], _count: true }),
    db.review.aggregate({ _avg: { rating: true }, where: { status: "PUBLISHED" } }),
  ]);
  const c = (s: string) => counts.find((x) => x.status === s)?._count ?? 0;
  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/admin/reviews${p.size ? `?${p}` : ""}`;
  };
  return (
    <>
      <PageHeader title="Product reviews" />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="Average rating (published)" value={avg._avg.rating ? `${avg._avg.rating.toFixed(2)} ★` : "-"} />
        <Stat label="Published" value={c("PUBLISHED")} />
        <Stat label="Awaiting moderation" value={c("PENDING")} />
      </div>
      <Card pad={false}>
        <Tabs current={status || "ALL"} tabs={[
          { key: "ALL", label: "All", href: href({ status: "", page: "" }) },
          { key: "PENDING", label: "Pending", href: href({ status: "PENDING", page: "" }), count: c("PENDING") },
          { key: "PUBLISHED", label: "Published", href: href({ status: "PUBLISHED", page: "" }), count: c("PUBLISHED") },
          { key: "HIDDEN", label: "Hidden", href: href({ status: "HIDDEN", page: "" }), count: c("HIDDEN") },
        ]} />
        <form className="flex flex-wrap gap-2 border-b border-slate-100 p-3">
          {status && <input type="hidden" name="status" value={status} />}
          <input name="q" defaultValue={sp.q} placeholder="Search review text, product or customer" className="in-a max-w-sm" />
          <AutoSubmitSelect name="rating" defaultValue={sp.rating ?? ""} className="in-a w-auto">
            <option value="">Any rating</option>{[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} stars</option>)}
          </AutoSubmitSelect>
        </form>
        {reviews.length ? (
          <>
            <form id="bulk" action={bulkReviews} className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2 text-sm">
              <span className="text-slate-500">With selected:</span>
              <button name="action" value="PUBLISHED" className="btn-a py-1">Publish</button>
              <button name="action" value="HIDDEN" className="btn-a py-1">Hide</button>
              <button name="action" value="delete" className="btn-a-danger py-1">Delete</button>
            </form>
            <ul className="divide-y divide-slate-100">
              {reviews.map((r) => (
                <li key={r.id} className="flex gap-3 p-4">
                  <input type="checkbox" name="ids" value={r.id} form="bulk" className="mt-1" aria-label="Select review" />
                  <img src={r.product.image} alt="" className="h-12 w-12 shrink-0 rounded border border-slate-200 object-contain" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-amber-500">{"★".repeat(r.rating)}<span className="text-slate-300">{"★".repeat(5 - r.rating)}</span></span>
                      <StatusBadge status={r.status} />
                      <Link href={`/admin/products/${r.product.id}`} className="text-sm font-semibold hover:underline">{r.product.name}</Link>
                    </div>
                    <p className="mt-1 text-sm text-slate-800">{r.comment}</p>
                    <p className="mt-1 text-xs text-slate-500">{r.user.name} ({r.user.email}) · {r.createdAt.toLocaleString("en-AE")}</p>
                    <form action={replyReview} className="mt-2 flex gap-2">
                      <input type="hidden" name="id" value={r.id} />
                      <input name="reply" defaultValue={r.reply ?? ""} placeholder="Public reply from the store (optional)" className="in-a py-1.5" />
                      <button className="btn-a">{r.reply ? "Update reply" : "Reply"}</button>
                    </form>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    {r.status !== "PUBLISHED" && <form action={setReviewStatus}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="PUBLISHED" /><button className="btn-a w-full">Publish</button></form>}
                    {r.status !== "HIDDEN" && <form action={setReviewStatus}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="HIDDEN" /><button className="btn-a w-full">Hide</button></form>}
                    <form action={deleteReview}><input type="hidden" name="id" value={r.id} /><ConfirmButton className="btn-a-danger w-full" message="Delete this review?">Delete</ConfirmButton></form>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : <EmptyState title="No reviews" description="Customer reviews will appear here for moderation." />}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} makeHref={(p) => href({ page: String(p) })} />
      </Card>
    </>
  );
}

import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { Card, EmptyState, PageHeader, StatusBadge, Tabs, th, td } from "@/components/admin/ui";
import Flash from "@/components/marketplace/Flash";
import { parseSpecs } from "@/lib/format";
import { reviewProducts } from "@/app/actions/admin/sellers";

export const metadata = { title: "Product approvals" };

export default async function ProductApprovals({ searchParams }: { searchParams: Promise<{ status?: string; msg?: string; error?: string }> }) {
  await requirePermission("sellers");
  const sp = await searchParams;
  const status = ["PENDING", "APPROVED", "REJECTED", "DRAFT"].includes(sp.status ?? "") ? sp.status! : "PENDING";
  const [products, counts] = await Promise.all([
    db.product.findMany({ where: { sellerId: { not: null }, approvalStatus: status }, include: { seller: true, variants: true, category: true, images: { orderBy: { position: "asc" } } }, orderBy: { updatedAt: "asc" } }),
    db.product.groupBy({ by: ["approvalStatus"], where: { sellerId: { not: null } }, _count: true }),
  ]);
  const c = (s: string) => counts.find((x) => x.approvalStatus === s)?._count ?? 0;
  return (
    <>
      <PageHeader back="/admin/sellers" title="Marketplace product approvals" subtitle="Seller products go live only after approval. Edits to title, description, images, specs or options send a product back here." />
      <Flash msg={sp.msg} error={sp.error} />
      <Card pad={false}>
        <Tabs current={status} tabs={["PENDING", "APPROVED", "REJECTED", "DRAFT"].map((s) => ({ key: s, label: s === "PENDING" ? "Awaiting review" : s.charAt(0) + s.slice(1).toLowerCase(), href: `/admin/sellers/products?status=${s}`, count: c(s) }))} />
        {products.length ? (
          <form action={reviewProducts}>
            <input type="hidden" name="return" value={`/admin/sellers/products?status=${status}`} />
            <div className="divide-y divide-slate-100">
              {products.map((p) => {
                const specs = parseSpecs(p.specs);
                return (
                  <div key={p.id} className="flex gap-4 p-4">
                    <input type="checkbox" name="ids" value={p.id} className="mt-1" aria-label={`Select ${p.name}`} />
                    <div className="flex gap-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {p.images.slice(0, 3).map((im) => <img key={im.id} src={im.url} alt="" className="h-16 w-16 rounded-lg border bg-slate-50 object-contain" />)}
                    </div>
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-semibold"><Link href={`/admin/products/${p.id}`} className="hover:underline">{p.brand} {p.name}</Link> <StatusBadge status={p.approvalStatus} /></p>
                      <p className="text-xs text-slate-500">🏪 <Link href={`/admin/sellers/${p.sellerId}`} className="hover:underline">{p.seller?.shopName}</Link> · {p.category.name} · updated {p.updatedAt.toLocaleString("en-AE")}</p>
                      <p className="mt-1 line-clamp-2 text-slate-600">{p.description}</p>
                      <p className="mt-1 text-xs text-slate-500">{Object.entries(specs).slice(0, 4).map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>
                      <table className="mt-2 text-xs"><tbody>{p.variants.map((v) => <tr key={v.id}><td className="pe-4">{v.title}</td><td className="pe-4">AED {v.price}{p.priceNew ? ` (new AED ${p.priceNew})` : ""}</td><td>{v.stock} in stock</td></tr>)}</tbody></table>
                      {p.rejectionReason && <p className="mt-1 text-xs text-red-600">Rejected: {p.rejectionReason}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t bg-white p-3">
              <button name="decision" value="APPROVED" className="btn-a-primary">Approve selected</button>
              <input name="reason" placeholder="Reason (required to reject)" className="in-a w-72" />
              <button name="decision" value="REJECTED" className="btn-a-danger">Reject selected</button>
            </div>
          </form>
        ) : <EmptyState title="Nothing here" description={status === "PENDING" ? "No seller products are waiting for review." : "No products with this status."} />}
      </Card>
    </>
  );
}

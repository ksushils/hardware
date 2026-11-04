import Link from "next/link";
import { db } from "@/lib/db";
import { requireSeller } from "@/lib/sellerAuth";
import { Card, EmptyState, PageHeader, StatusBadge, th, td } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/client";
import Flash from "@/components/marketplace/Flash";
import { deleteSellerProduct, updateSellerStock } from "@/app/actions/seller";

export const metadata = { title: "Products" };

export default async function SellerProducts({ searchParams }: { searchParams: Promise<{ saved?: string; q?: string }> }) {
  const { seller } = await requireSeller();
  const sp = await searchParams;
  const products = await db.product.findMany({
    where: { sellerId: seller.id, status: { not: "ARCHIVED" }, ...(sp.q ? { name: { contains: sp.q } } : {}) },
    include: { variants: { orderBy: { position: "asc" } }, category: true }, orderBy: { updatedAt: "desc" },
  });
  const savedMsg: Record<string, string> = { PENDING: "Saved — submitted for approval. We'll email you once it's reviewed.", APPROVED: "Saved — your product is live.", DRAFT: "Saved as draft." };
  return (
    <>
      <PageHeader title="Products" actions={<Link href="/seller/products/new" className="btn-a-primary">Add product</Link>} />
      <Flash msg={sp.saved ? savedMsg[sp.saved] : undefined} />
      <Card pad={false}>
        <form className="border-b border-slate-100 p-3"><input name="q" defaultValue={sp.q} placeholder="Search your products" className="in-a" /></form>
        {products.length ? (
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50"><tr><th className={th}>Product</th><th className={th}>Approval</th><th className={th}>Variants & stock</th><th className={th} /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => (
                <tr key={p.id} className="align-top">
                  <td className={td}>
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.image} alt="" className="h-12 w-12 rounded-lg border bg-slate-50 object-contain" />
                      <div><Link href={`/seller/products/${p.id}`} className="font-semibold hover:underline">{p.name}</Link><p className="text-xs text-slate-500">{p.brand} · {p.category.name}</p></div>
                    </div>
                  </td>
                  <td className={td}><StatusBadge status={p.approvalStatus} />{p.rejectionReason && p.approvalStatus === "REJECTED" && <p className="mt-1 max-w-48 text-xs text-red-600">{p.rejectionReason}</p>}</td>
                  <td className={td}>
                    <div className="space-y-1">
                      {p.variants.map((v) => (
                        <form key={v.id} action={updateSellerStock} className="flex items-center gap-2 text-xs">
                          <input type="hidden" name="variantId" value={v.id} />
                          <span className="w-28 truncate">{v.title === "Default Title" ? "Default" : v.title}</span><span className="w-20">AED {v.price}</span>
                          <input name="stock" type="number" min={0} defaultValue={v.stock} className={`in-a w-16 py-0.5 ${v.stock <= 2 ? "border-amber-400" : ""}`} aria-label="Stock" />
                          <button className="text-sky-700">Update</button>
                        </form>
                      ))}
                    </div>
                  </td>
                  <td className={td}>
                    <div className="flex flex-col items-end gap-1">
                      <Link href={`/seller/products/${p.id}`} className="btn-a">Edit</Link>
                      {p.approvalStatus === "APPROVED" && <Link href={`/products/${p.slug}`} target="_blank" className="text-xs text-sky-700">View ↗</Link>}
                      <form action={deleteSellerProduct}><input type="hidden" name="id" value={p.id} /><ConfirmButton message="Delete this product? Products with orders are archived instead." className="text-xs text-red-600">Delete</ConfirmButton></form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState title="No products yet" description="Add your first product. It goes live once the marketplace team approves it." action={<Link href="/seller/products/new" className="btn-a-primary">Add product</Link>} />}
      </Card>
    </>
  );
}

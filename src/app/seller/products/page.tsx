import Link from "next/link";
import { db } from "@/lib/db";
import { requireSeller } from "@/lib/sellerAuth";
import { Card, EmptyState, PageHeader, StatusBadge, th, td } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/client";
import Flash from "@/components/marketplace/Flash";
import { deleteSellerProduct } from "@/app/actions/seller";
import { deleteSellerOffer, updateOfferPriceStock } from "@/app/actions/sellerOffers";
import { CONDITION_TYPE_LABEL, effectiveCondition } from "@/lib/offers";

export const metadata = { title: "Products & offers" };

const SAVED: Record<string, string> = {
  PENDING: "Saved — submitted for approval. We'll email you once it's reviewed.", APPROVED: "Saved — your product is live.", DRAFT: "Saved as draft.",
  OFFER_PENDING: "Offer saved — it goes live once the marketplace team approves it. We'll email you.", OFFER_LIVE: "Offer saved — it's live.",
};

export default async function SellerProducts({ searchParams }: { searchParams: Promise<{ saved?: string; q?: string }> }) {
  const { seller } = await requireSeller();
  const sp = await searchParams;
  const [offers, created] = await Promise.all([
    db.variant.findMany({
      where: { sellerId: seller.id, product: { status: { not: "ARCHIVED" }, ...(sp.q ? { name: { contains: sp.q } } : {}) } },
      include: { product: { select: { id: true, name: true, slug: true, image: true, brand: true, approvalStatus: true, status: true, sellerId: true } } },
      orderBy: [{ productId: "asc" }, { position: "asc" }],
    }),
    db.product.findMany({ where: { sellerId: seller.id, status: { not: "ARCHIVED" }, approvalStatus: { not: "APPROVED" } }, select: { id: true, name: true, image: true, brand: true, approvalStatus: true, rejectionReason: true }, orderBy: { updatedAt: "desc" } }),
  ]);
  const groups = new Map<string, typeof offers>();
  offers.forEach((o) => groups.set(o.productId, [...(groups.get(o.productId) ?? []), o]));
  return (
    <>
      <PageHeader title="Products & offers" subtitle="Every listing is an offer on a shared product page. Buyers compare offers from different sellers."
        actions={<><Link href="/seller/products/offers/new" className="btn-a-primary">Add offer to existing product</Link><Link href="/seller/products/new" className="btn-a">Create new product</Link><Link href="/seller/import" className="btn-a">Bulk import</Link></>} />
      <Flash msg={sp.saved ? SAVED[sp.saved] : undefined} />

      {created.length > 0 && (
        <Card title="New products awaiting review" className="mb-4">
          <div className="divide-y divide-slate-100 text-sm">
            {created.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image} alt="" className="h-10 w-10 rounded-lg border bg-slate-50 object-contain" />
                <div className="min-w-0 flex-1"><Link href={`/seller/products/${p.id}`} className="font-semibold hover:underline">{p.name}</Link><p className="text-xs text-slate-500">{p.brand}</p>{p.rejectionReason && p.approvalStatus === "REJECTED" && <p className="text-xs text-red-600">{p.rejectionReason}</p>}</div>
                <StatusBadge status={p.approvalStatus} />
                <form action={deleteSellerProduct}><input type="hidden" name="id" value={p.id} /><ConfirmButton message="Delete this product proposal?" className="text-xs text-red-600">Delete</ConfirmButton></form>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card pad={false} title={`My offers (${offers.length})`}>
        <form className="border-b border-slate-100 p-3"><input name="q" defaultValue={sp.q} placeholder="Search your offers by product" className="in-a" /></form>
        {offers.length ? (
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50"><tr><th className={th}>Product / offer</th><th className={th}>Condition</th><th className={th}>Status</th><th className={th}>Price & stock</th><th className={th} /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {[...groups.values()].flatMap((list) => list.map((o, i) => {
                const cond = effectiveCondition(o, null);
                return (
                  <tr key={o.id} className="align-top">
                    <td className={td}>
                      {i === 0 ? (
                        <div className="flex items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={o.product.image} alt="" className="h-12 w-12 rounded-lg border bg-slate-50 object-contain" />
                          <div><p className="font-semibold">{o.product.name}</p><p className="text-xs text-slate-500">{o.product.brand} · {o.title === "Default Title" ? "Default" : o.title}</p></div>
                        </div>
                      ) : <p className="ps-14 text-xs text-slate-500">{o.title === "Default Title" ? "Default" : o.title}</p>}
                    </td>
                    <td className={td}>
                      <p className="text-xs">{cond.type ? CONDITION_TYPE_LABEL[cond.type][0] : "—"}{cond.grade ? ` · ${cond.grade}` : ""}</p>
                      <p className="text-xs text-slate-500">{o.verification === "PLATFORM_VERIFIED" ? "✓ Verified by TechRevive" : o.verification === "SELLER_DECLARED" ? "Seller-declared" : "No evidence supplied"}</p>
                    </td>
                    <td className={td}><StatusBadge status={o.approvalStatus} />{o.rejectionReason && o.approvalStatus === "REJECTED" && <p className="mt-1 max-w-48 text-xs text-red-600">{o.rejectionReason}</p>}</td>
                    <td className={td}>
                      <form action={updateOfferPriceStock} className="flex items-center gap-1.5 text-xs">
                        <input type="hidden" name="variantId" value={o.id} />
                        <input name="price" type="number" step="0.01" defaultValue={o.price} className="in-a w-24 py-0.5" aria-label="Price" />
                        <input name="stock" type="number" min={0} defaultValue={o.stock} className={`in-a w-16 py-0.5 ${o.stock <= 2 ? "border-amber-400" : ""}`} aria-label="Stock" />
                        <button className="text-sky-700">Update</button>
                      </form>
                    </td>
                    <td className={td}>
                      <div className="flex flex-col items-end gap-1">
                        <Link href={`/seller/products/offers/${o.id}`} className="btn-a">Edit</Link>
                        {o.approvalStatus === "APPROVED" && o.product.approvalStatus === "APPROVED" && <Link href={`/products/${o.product.slug}`} target="_blank" className="text-xs text-sky-700">View ↗</Link>}
                        <form action={deleteSellerOffer}><input type="hidden" name="id" value={o.id} /><ConfirmButton message="Remove this offer? Offers that already sold are hidden instead of deleted." className="text-xs text-red-600">Remove</ConfirmButton></form>
                      </div>
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        ) : <EmptyState title="No offers yet" description="Find a product already in the catalogue and add your price, stock and condition. Or create a new product for approval." action={<Link href="/seller/products/offers/new" className="btn-a-primary">Add offer to existing product</Link>} />}
      </Card>
    </>
  );
}

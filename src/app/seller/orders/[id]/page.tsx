import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSeller } from "@/lib/sellerAuth";
import { Card, PageHeader, StatusBadge, th, td } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/client";
import Flash from "@/components/marketplace/Flash";
import { updateSellerOrder } from "@/app/actions/seller";

export const metadata = { title: "Order" };
const ERR: Record<string, string> = { transition: "That status change isn't allowed.", tracking: "Enter a tracking number to mark as shipped.", cancelled: "This order was cancelled by the customer or store." };

export default async function SellerOrderDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { seller } = await requireSeller();
  const { id } = await params;
  const sp = await searchParams;
  const so = await db.sellerOrder.findFirst({ where: { id, sellerId: seller.id }, include: { order: true, items: true } });
  if (!so) notFound();
  const o = so.order;
  const hid = <input type="hidden" name="id" value={so.id} />;
  const cancelled = o.status === "CANCELLED";
  return (
    <>
      <PageHeader back="/seller/orders" title={<span className="flex items-center gap-2">Order {o.number} <StatusBadge status={cancelled ? "CANCELLED" : so.status} /></span>} subtitle={`Placed ${o.createdAt.toLocaleString("en-AE")}`}
        actions={<Link href={`/seller/orders/${so.id}/packing-slip`} target="_blank" className="btn-a">Print packing slip</Link>} />
      <Flash msg={sp.ok ? "Order updated." : undefined} error={sp.error ? ERR[sp.error] : undefined} />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Card title="Items to ship" pad={false}>
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50"><tr><th className={th}>Item</th><th className={th}>SKU</th><th className={th}>Qty</th><th className={th}>Price</th><th className={th}>Commission</th><th className={th}>You earn</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {so.items.map((i) => (
                  <tr key={i.id}><td className={td}><b>{i.name}</b>{i.variantTitle && <span className="block text-xs text-slate-500">{i.variantTitle}</span>}</td><td className={td}>{i.sku ?? "—"}</td><td className={td}>{i.quantity}</td><td className={td}>AED {i.price}</td><td className={td}>AED {i.commissionAmount}</td><td className={`${td} font-semibold`}>AED {i.sellerEarning}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end gap-6 border-t p-3 text-sm"><span>Subtotal AED {so.subtotal}</span><span>Commission AED {so.commissionTotal}</span><b>Your earning AED {so.sellerEarning}</b></div>
          </Card>
          {!cancelled && (
            <Card title="Fulfilment">
              {so.status === "PENDING" && <form action={updateSellerOrder} className="mb-3">{hid}<input type="hidden" name="status" value="PROCESSING" /><SubmitButton className="btn-a">Mark as processing</SubmitButton></form>}
              {["PENDING", "PROCESSING"].includes(so.status) && (
                <form action={updateSellerOrder} className="flex flex-wrap items-end gap-2">{hid}<input type="hidden" name="status" value="SHIPPED" />
                  <label><span className="label">Carrier</span><select name="trackingCompany" className="in-a w-40"><option>Aramex</option><option>Emirates Post</option><option>DHL</option><option>Fetchr</option><option>Quiqup</option><option>Own delivery</option></select></label>
                  <label><span className="label">Tracking number</span><input name="trackingNumber" required className="in-a w-48" /></label>
                  <SubmitButton className="btn-a-primary">Mark as shipped</SubmitButton>
                </form>
              )}
              {so.status === "SHIPPED" && (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span>Shipped {so.shippedAt?.toLocaleDateString("en-AE")} via {so.trackingCompany} · <b>{so.trackingNumber}</b></span>
                  <form action={updateSellerOrder}>{hid}<input type="hidden" name="status" value="DELIVERED" /><SubmitButton className="btn-a-primary">Mark as delivered</SubmitButton></form>
                </div>
              )}
              {so.status === "DELIVERED" && <p className="text-sm text-emerald-700">✓ Delivered {so.deliveredAt?.toLocaleDateString("en-AE")}. Your earning is credited and becomes withdrawable after the hold period.</p>}
            </Card>
          )}
        </div>
        <div className="space-y-5">
          <Card title="Ship to">
            <p className="text-sm">{o.fullName}<br />{o.building}, {o.street}<br />{o.area}, {o.emirate}<br />{o.phone}</p>
            {o.customerNote && <p className="mt-2 rounded bg-amber-50 p-2 text-xs">Note: {o.customerNote}</p>}
          </Card>
          <Card title="Payment">
            <p className="text-sm">{o.paymentMethod === "COD" ? "Cash on delivery — collected by the store's courier or you on delivery as agreed with the marketplace." : "Paid online to the marketplace."}</p>
            <p className="mt-1"><StatusBadge status={o.paymentStatus} /></p>
          </Card>
        </div>
      </div>
    </>
  );
}

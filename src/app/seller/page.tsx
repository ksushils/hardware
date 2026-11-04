import Link from "next/link";
import { db } from "@/lib/db";
import { requireSeller } from "@/lib/sellerAuth";
import { sellerBalance } from "@/lib/marketplace";
import { BarChart, Card, PageHeader, Stat, StatusBadge, th, td } from "@/components/admin/ui";

export const metadata = { title: "Dashboard" };

export default async function SellerDashboard() {
  const { seller } = await requireSeller();
  const since = new Date(Date.now() - 30 * 86400_000);
  const [bal, totals, recent, lowStock, pendingProducts, last30, reviews, unread] = await Promise.all([
    sellerBalance(seller.id),
    db.sellerOrder.aggregate({ where: { sellerId: seller.id, status: { notIn: ["CANCELLED", "REFUNDED"] } }, _sum: { subtotal: true, commissionTotal: true, sellerEarning: true }, _count: true }),
    db.sellerOrder.findMany({ where: { sellerId: seller.id }, include: { order: { select: { number: true, fullName: true, emirate: true } }, items: true }, orderBy: { createdAt: "desc" }, take: 8 }),
    db.variant.findMany({ where: { sellerId: seller.id, product: { status: "ACTIVE" }, approvalStatus: "APPROVED", trackInventory: true, stock: { lte: 2 } }, include: { product: true }, take: 8, orderBy: { stock: "asc" } }),
    // products the seller proposed + their offers that await approval or need changes
    db.variant.count({ where: { sellerId: seller.id, approvalStatus: { in: ["PENDING", "REJECTED"] } } }),
    db.sellerOrder.findMany({ where: { sellerId: seller.id, createdAt: { gte: since }, status: { notIn: ["CANCELLED"] } }, select: { createdAt: true, subtotal: true } }),
    db.sellerReview.findMany({ where: { sellerId: seller.id, status: "PUBLISHED" }, orderBy: { createdAt: "desc" }, take: 3 }),
    db.sellerMessage.count({ where: { sellerId: seller.id, readAt: null } }),
  ]);
  const toShip = await db.sellerOrder.count({ where: { sellerId: seller.id, status: { in: ["PENDING", "PROCESSING"] }, order: { status: { not: "CANCELLED" } } } });
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * 86400_000);
    const key = d.toISOString().slice(0, 10);
    return { label: d.toLocaleDateString("en-AE", { day: "numeric", month: "short" }), value: last30.filter((o) => o.createdAt.toISOString().slice(0, 10) === key).reduce((s, o) => s + o.subtotal, 0) };
  });
  return (
    <>
      <PageHeader title={`Welcome back, ${seller.shopName}`} actions={<Link href="/seller/products/new" className="btn-a-primary">Add product</Link>} />
      {seller.vacationMode && <p className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">🏖️ Vacation mode is on — customers can&apos;t buy your products. <Link href="/seller/settings" className="underline">Turn off</Link></p>}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total sales" value={`AED ${(totals._sum.subtotal ?? 0).toLocaleString()}`} sub={`${totals._count} order(s)`} />
        <Stat label="Your earnings" value={`AED ${(totals._sum.sellerEarning ?? 0).toLocaleString()}`} sub={`Commission AED ${(totals._sum.commissionTotal ?? 0).toLocaleString()}`} />
        <Stat label="Available to withdraw" value={`AED ${bal.available.toLocaleString()}`} sub={<Link href="/seller/payouts" className="text-violet-700 underline">Request payout</Link>} />
        <Stat label="In hold period" value={`AED ${bal.pending.toLocaleString()}`} sub="Released after the return window" />
      </div>
      <div className="mb-5 grid gap-3 md:grid-cols-3">
        {[[toShip, "orders to ship", "/seller/orders?status=open"], [pendingProducts, "offers awaiting approval or changes", "/seller/products"], [unread, "unread messages", "/seller/messages"]].map(([n, l, h]) => (
          <Link key={String(h)} href={String(h)} className={`rounded-xl border p-4 text-sm shadow-sm ${Number(n) ? "border-violet-200 bg-violet-50" : "border-slate-200 bg-white"}`}><b className="text-xl">{n}</b> {l} →</Link>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Card title="Sales — last 30 days"><BarChart data={days} format={(n) => `AED ${n.toLocaleString()}`} /></Card>
          <Card title="Recent orders" pad={false} actions={<Link href="/seller/orders" className="text-xs text-violet-700">View all</Link>}>
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50"><tr><th className={th}>Order</th><th className={th}>Customer</th><th className={th}>Items</th><th className={th}>Earning</th><th className={th}>Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {recent.map((o) => (
                  <tr key={o.id}><td className={td}><Link href={`/seller/orders/${o.id}`} className="font-medium hover:underline">{o.order.number}</Link></td><td className={td}>{o.order.fullName}, {o.order.emirate}</td><td className={td}>{o.items.reduce((s, i) => s + i.quantity, 0)}</td><td className={td}>AED {o.sellerEarning}</td><td className={td}><StatusBadge status={o.status} /></td></tr>
                ))}
                {!recent.length && <tr><td colSpan={5} className="p-4 text-slate-500">No orders yet. Make sure your products are approved and in stock.</td></tr>}
              </tbody>
            </table>
          </Card>
        </div>
        <div className="space-y-5">
          <Card title="Low stock">
            {lowStock.length ? <ul className="space-y-1.5 text-sm">{lowStock.map((v) => <li key={v.id} className="flex justify-between gap-2"><Link href={`/seller/products/${v.productId}`} className="truncate hover:underline">{v.product.name} <span className="text-slate-400">{v.title}</span></Link><b className={v.stock ? "text-amber-600" : "text-red-600"}>{v.stock}</b></li>)}</ul> : <p className="text-sm text-slate-500">All good 👍</p>}
          </Card>
          <Card title={`Rating ${seller.ratingCount ? `★ ${seller.ratingAvg} (${seller.ratingCount})` : ""}`}>
            {reviews.length ? reviews.map((r) => <p key={r.id} className="mb-2 text-sm"><span className="text-amber-500">{"★".repeat(r.rating)}</span> {r.comment}</p>) : <p className="text-sm text-slate-500">No reviews yet.</p>}
          </Card>
        </div>
      </div>
    </>
  );
}

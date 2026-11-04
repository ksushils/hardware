import Link from "next/link";
import { db } from "@/lib/db";
import { requireSeller } from "@/lib/sellerAuth";
import { Card, EmptyState, PageHeader, StatusBadge, Tabs, th, td } from "@/components/admin/ui";

export const metadata = { title: "Orders" };

export default async function SellerOrders({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { seller } = await requireSeller();
  const sp = await searchParams;
  const tab = sp.status ?? "all";
  const statusWhere = tab === "open" ? { status: { in: ["PENDING", "PROCESSING"] } } : tab === "shipped" ? { status: "SHIPPED" } : tab === "delivered" ? { status: "DELIVERED" } : tab === "cancelled" ? { status: { in: ["CANCELLED", "REFUNDED"] } } : {};
  const orders = await db.sellerOrder.findMany({
    where: { sellerId: seller.id, ...statusWhere }, orderBy: { createdAt: "desc" }, take: 200,
    include: { order: { select: { number: true, fullName: true, emirate: true, status: true, paymentMethod: true, paymentStatus: true, createdAt: true } }, items: true },
  });
  return (
    <>
      <PageHeader title="Orders" subtitle="You only see the items from your shop. Ship within 2 business days and add tracking." />
      <Card pad={false}>
        <Tabs current={tab} tabs={[["all", "All"], ["open", "To ship"], ["shipped", "Shipped"], ["delivered", "Delivered"], ["cancelled", "Cancelled"]].map(([k, l]) => ({ key: k, label: l, href: `/seller/orders?status=${k}` }))} />
        {orders.length ? (
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50"><tr><th className={th}>Order</th><th className={th}>Date</th><th className={th}>Ship to</th><th className={th}>Items</th><th className={th}>Payment</th><th className={th}>Your earning</th><th className={th}>Status</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className={td}><Link href={`/seller/orders/${o.id}`} className="font-semibold hover:underline">{o.order.number}</Link></td>
                  <td className={td}>{o.order.createdAt.toLocaleDateString("en-AE")}</td>
                  <td className={td}>{o.order.fullName}, {o.order.emirate}</td>
                  <td className={td}>{o.items.map((i) => `${i.name} × ${i.quantity}`).join(", ")}</td>
                  <td className={td}>{o.order.paymentMethod === "COD" ? "Cash on delivery" : "Paid online"} <StatusBadge status={o.order.paymentStatus} /></td>
                  <td className={td}>AED {o.sellerEarning}</td>
                  <td className={td}>{o.order.status === "CANCELLED" ? <StatusBadge status="CANCELLED" /> : <StatusBadge status={o.status} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState title="No orders here" />}
      </Card>
    </>
  );
}

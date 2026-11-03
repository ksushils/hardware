import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { aed } from "@/lib/format";
import { StatusBadge } from "@/components/OrderView";

export const metadata = { title: "My Orders" };

export default async function OrdersPage() {
  const user = await requireUser("/account/orders");
  const orders = await db.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { _count: { select: { items: true } } } });
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="p-4">Order</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th><th></th></tr></thead>
        <tbody className="divide-y">
          {orders.map((o) => (
            <tr key={o.id}>
              <td className="p-4 font-semibold">{o.number}</td>
              <td>{o.createdAt.toLocaleDateString("en-AE")}</td>
              <td>{o._count.items}</td>
              <td>{aed(o.total)}</td>
              <td><StatusBadge status={o.status} /></td>
              <td className="pr-4 text-right"><Link href={`/order/${o.number}`} className="font-semibold text-brand-700">View</Link></td>
            </tr>
          ))}
          {orders.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">You haven&apos;t placed any orders yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

import Link from "next/link";
import { db } from "@/lib/db";
import { aed, ORDER_STATUSES } from "@/lib/format";
import { StatusBadge } from "@/components/OrderView";

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status, q } = await searchParams;
  const orders = await db.order.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(q ? { OR: [{ number: { contains: q.toUpperCase() } }, { email: { contains: q.toLowerCase() } }, { fullName: { contains: q } }, { phone: { contains: q } }] } : {}),
    },
    orderBy: { createdAt: "desc" }, take: 200,
  });
  return (
    <div className="space-y-4">
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Order #, email, name, phone" className="input w-72 py-2" />
        <select name="status" defaultValue={status ?? ""} className="input w-44 py-2"><option value="">All statuses</option>{ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <button className="btn-dark py-2">Filter</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="p-3">Order</th><th>Date</th><th>Customer</th><th>Emirate</th><th>Payment</th><th>Total</th><th>Status</th></tr></thead>
          <tbody className="divide-y">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50">
                <td className="p-3"><Link href={`/admin/orders/${o.number}`} className="font-semibold text-brand-700">{o.number}</Link></td>
                <td>{o.createdAt.toLocaleDateString("en-AE")}</td>
                <td>{o.fullName}<br /><span className="text-xs text-slate-500">{o.email}</span></td>
                <td>{o.emirate}</td>
                <td>{o.paymentMethod} · <span className={o.paymentStatus === "PAID" ? "text-brand-700" : "text-amber-600"}>{o.paymentStatus}</span></td>
                <td>{aed(o.total)}</td>
                <td><StatusBadge status={o.status} /></td>
              </tr>
            ))}
            {!orders.length && <tr><td colSpan={7} className="p-8 text-center text-slate-500">No orders.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

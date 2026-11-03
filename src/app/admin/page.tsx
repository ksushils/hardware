import Link from "next/link";
import { db } from "@/lib/db";
import { aed } from "@/lib/format";
import { StatusBadge } from "@/components/OrderView";

export default async function AdminDashboard() {
  const [paidAgg, orderCount, pending, customers, lowStock, recent] = await Promise.all([
    db.order.aggregate({ _sum: { total: true }, where: { paymentStatus: "PAID" } }),
    db.order.count(),
    db.order.count({ where: { status: { in: ["PAID", "PROCESSING"] } } }),
    db.user.count({ where: { role: "CUSTOMER" } }),
    db.variant.findMany({ where: { stock: { lte: 2 } }, include: { product: true }, take: 10, orderBy: { stock: "asc" } }),
    db.order.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const stats = [
    ["Revenue (paid)", aed(paidAgg._sum.total ?? 0)], ["Orders", orderCount], ["To fulfil", pending], ["Customers", customers],
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(([l, v]) => <div key={String(l)} className="card p-5"><p className="text-sm text-slate-500">{l}</p><p className="mt-1 text-2xl font-black">{v}</p></div>)}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-bold">Recent orders</h2>
          <ul className="mt-3 divide-y text-sm">
            {recent.map((o) => (
              <li key={o.id}><Link href={`/admin/orders/${o.number}`} className="flex items-center justify-between gap-2 py-2.5 hover:bg-slate-50">
                <span className="font-semibold">{o.number}</span><span className="truncate text-slate-500">{o.fullName}</span><StatusBadge status={o.status} /><span>{aed(o.total)}</span>
              </Link></li>
            ))}
            {!recent.length && <li className="py-3 text-slate-500">No orders yet.</li>}
          </ul>
        </div>
        <div className="card p-5">
          <h2 className="font-bold">Low stock</h2>
          <ul className="mt-3 divide-y text-sm">
            {lowStock.map((v) => (
              <li key={v.id}><Link href={`/admin/products/${v.productId}`} className="flex justify-between py-2.5 hover:bg-slate-50">
                <span>{v.product.name} <span className="text-slate-500">({v.condition})</span></span>
                <span className={v.stock === 0 ? "font-bold text-red-600" : "font-bold text-amber-600"}>{v.stock} left</span>
              </Link></li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

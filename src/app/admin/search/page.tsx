import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { aed } from "@/lib/format";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/admin/ui";

export const metadata = { title: "Search" };

export default async function AdminSearch({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireStaff();
  const q = ((await searchParams).q ?? "").trim();
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(user, p);
  const [orders, products, customers] = q ? await Promise.all([
    can("orders") ? db.order.findMany({ where: { OR: [{ number: { contains: q.toUpperCase() } }, { email: { contains: q.toLowerCase() } }, { fullName: { contains: q } }, { phone: { contains: q } }] }, orderBy: { createdAt: "desc" }, take: 10 }) : [],
    can("products") ? db.product.findMany({ where: { OR: [{ name: { contains: q } }, { nameAr: { contains: q } }, { brand: { contains: q } }, { variants: { some: { OR: [{ sku: { contains: q.toUpperCase() } }, { barcode: { contains: q } }] } } }] }, include: { variants: { select: { stock: true } } }, take: 10 }) : [],
    can("customers") ? db.user.findMany({ where: { role: "CUSTOMER", OR: [{ name: { contains: q } }, { email: { contains: q.toLowerCase() } }, { phone: { contains: q } }] }, include: { _count: { select: { orders: true } } }, take: 10 }) : [],
  ]) : [[], [], []];
  const none = q && !orders.length && !products.length && !customers.length;

  return (
    <div className="space-y-5">
      <PageHeader title="Search" />
      <form><input name="q" defaultValue={q} autoFocus placeholder="Search orders, products, customers…" className="in-a py-2.5" /></form>
      {none && <Card><EmptyState title={`No results for “${q}”`} description="Try an order number, email, product name or SKU." /></Card>}
      {orders.length > 0 && (
        <Card title={`Orders (${orders.length})`} pad={false}>
          <ul className="divide-y divide-slate-100 text-sm">
            {orders.map((o) => (
              <li key={o.id}><Link href={`/admin/orders/${o.number}`} className="flex flex-wrap items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                <span className="w-32 font-semibold">{o.number}</span><span className="flex-1 truncate">{o.fullName} · <span className="text-slate-500">{o.email}</span></span>
                <StatusBadge status={o.paymentStatus} /><span className="tabular-nums">{aed(o.total)}</span>
              </Link></li>
            ))}
          </ul>
        </Card>
      )}
      {products.length > 0 && (
        <Card title={`Products (${products.length})`} pad={false}>
          <ul className="divide-y divide-slate-100 text-sm">
            {products.map((p) => (
              <li key={p.id}><Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                <span className="flex-1 truncate font-medium">{p.name} <span className="font-normal text-slate-500">· {p.brand}</span></span>
                <StatusBadge status={p.status} /><span className="text-slate-500">{p.variants.reduce((s, v) => s + v.stock, 0)} in stock</span>
              </Link></li>
            ))}
          </ul>
        </Card>
      )}
      {customers.length > 0 && (
        <Card title={`Customers (${customers.length})`} pad={false}>
          <ul className="divide-y divide-slate-100 text-sm">
            {customers.map((c) => (
              <li key={c.id}><Link href={`/admin/customers/${c.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                <span className="flex-1 truncate font-medium">{c.name} <span className="font-normal text-slate-500">· {c.email}</span></span>
                <span className="text-slate-500">{c._count.orders} orders</span>
              </Link></li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

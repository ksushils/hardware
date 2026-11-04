import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { aed, csv } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader, Pagination, td, th } from "@/components/admin/ui";
import { Banner, customerWhere, one, qs, type SP } from "@/components/admin/sales/queries";
import { customerStats } from "@/components/admin/sales/customerStats";

export const metadata = { title: "Customers" };
const PAGE = 25;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePermission("customers");
  const sp = await searchParams;
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const where = customerWhere(sp);
  const [customers, total, all] = await Promise.all([
    db.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { addresses: { where: { isDefault: true }, take: 1 } } }),
    db.user.count({ where }),
    db.user.count({ where: { role: "CUSTOMER" } }),
  ]);
  const stats = await customerStats(customers.map((c) => c.id));
  return (
    <>
      <PageHeader title="Customers" subtitle={`${all} customers`}
        actions={<>
          <a href={`/api/admin/export/customers${qs(sp, { page: undefined, msg: undefined })}`} className="btn-a">Export CSV</a>
          <Link href="/admin/customers/new" className="btn-a-primary">Add customer</Link>
        </>} />
      <Banner sp={sp} />
      <Card pad={false}>
        <form className="flex flex-wrap gap-2 border-b border-slate-100 p-3">
          <input name="q" defaultValue={one(sp.q)} placeholder="Search name, email or phone" className="in-a min-w-60 flex-1" />
          <select name="marketing" defaultValue={one(sp.marketing)} className="in-a w-auto"><option value="">Email marketing</option><option value="yes">Subscribed</option><option value="no">Not subscribed</option></select>
          <select name="orders" defaultValue={one(sp.orders)} className="in-a w-auto"><option value="">Orders</option><option value="yes">Has orders</option><option value="no">No orders</option></select>
          <input name="tag" defaultValue={one(sp.tag)} placeholder="Tag" className="in-a w-32" />
          <button className="btn-a-primary">Filter</button>
        </form>
        {customers.length === 0 ? <EmptyState title="No customers found" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50"><tr><th className={th}>Customer</th><th className={th}>Marketing</th><th className={th}>Location</th><th className={th}>Orders</th><th className={th}>Amount spent</th><th className={th}>Since</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((c) => {
                  const st = stats.get(c.id);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className={td}>
                        <Link href={`/admin/customers/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                        {c.disabled && <span className="ms-1.5"><Badge tone="red">Disabled</Badge></span>}
                        <div className="text-xs text-slate-500">{c.email}</div>
                        <div className="mt-0.5 flex flex-wrap gap-1">{csv(c.tags).map((t) => <Badge key={t}>{t}</Badge>)}</div>
                      </td>
                      <td className={td}>{c.acceptsMarketing ? <Badge tone="green">Subscribed</Badge> : <Badge>Not subscribed</Badge>}</td>
                      <td className={td}>{c.addresses[0] ? `${c.addresses[0].area}, ${c.addresses[0].emirate}` : "—"}</td>
                      <td className={td}>{st?.orders ?? 0}</td>
                      <td className={td}>{aed(st?.spent ?? 0)}</td>
                      <td className={`${td} text-slate-600`}>{c.createdAt.toLocaleDateString("en-AE", { dateStyle: "medium" })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageSize={PAGE} total={total} makeHref={(p) => `/admin/customers${qs(sp, { page: p, msg: undefined })}`} />
      </Card>
    </>
  );
}

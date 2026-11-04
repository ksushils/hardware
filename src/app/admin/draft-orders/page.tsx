import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { aed } from "@/lib/format";
import { Card, EmptyState, PageHeader, Pagination, td, th } from "@/components/admin/ui";
import { Banner, one, qs, type SP } from "@/components/admin/sales/queries";

export const metadata = { title: "Draft orders" };
const PAGE = 25;

export default async function DraftsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePermission("orders");
  const sp = await searchParams;
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const q = one(sp.q).trim();
  const where = { status: "DRAFT", ...(q ? { OR: [{ number: { contains: q.toUpperCase() } }, { email: { contains: q.toLowerCase() } }, { fullName: { contains: q } }] } : {}) };
  const [drafts, total] = await Promise.all([
    db.order.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { _count: { select: { items: true } }, events: { where: { type: "email" }, take: 1 } } }),
    db.order.count({ where }),
  ]);
  return (
    <>
      <PageHeader title="Drafts" subtitle="Create orders for customers by phone, WhatsApp or in store, and send them an invoice to pay." actions={<Link href="/admin/draft-orders/new" className="btn-a-primary">Create order</Link>} />
      <Banner sp={sp} />
      <Card pad={false}>
        <form className="border-b border-slate-100 p-3"><input name="q" defaultValue={q} placeholder="Search drafts" className="in-a" /></form>
        {drafts.length === 0 ? <EmptyState title="No draft orders" description="Drafts let you create orders on behalf of customers." action={<Link href="/admin/draft-orders/new" className="btn-a-primary">Create order</Link>} /> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr><th className={th}>Draft</th><th className={th}>Updated</th><th className={th}>Customer</th><th className={th}>Status</th><th className={th}>Total</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {drafts.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className={td}><Link href={`/admin/draft-orders/${d.number}`} className="font-semibold hover:underline">{d.number}</Link></td>
                  <td className={`${td} text-slate-600`}>{d.updatedAt.toLocaleString("en-AE", { dateStyle: "medium", timeStyle: "short" })}</td>
                  <td className={td}>{d.fullName}<div className="text-xs text-slate-500">{d.email}</div></td>
                  <td className={td}>{d.events.length ? <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">Invoice sent</span> : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">Open</span>}</td>
                  <td className={td}>{aed(d.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} pageSize={PAGE} total={total} makeHref={(p) => `/admin/draft-orders${qs(sp, { page: p })}`} />
      </Card>
    </>
  );
}

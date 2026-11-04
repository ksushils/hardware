import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { Badge, Card, EmptyState, PageHeader, Pagination, td, th } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/client";
import { SelectAll } from "@/components/admin/sales/client";
import { Banner, one, qs, type SP } from "@/components/admin/sales/queries";
import { deleteSubscriber } from "@/app/actions/admin/customers";

export const metadata = { title: "Subscribers" };
const PAGE = 50;

export default async function SubscribersPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePermission("customers");
  const sp = await searchParams;
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const q = one(sp.q).trim().toLowerCase();
  const where = q ? { email: { contains: q } } : {};
  const [rows, total] = await Promise.all([
    db.subscriber.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
    db.subscriber.count({ where }),
  ]);
  return (
    <>
      <PageHeader title="Subscribers" subtitle="Newsletter sign-ups from the storefront." actions={<a href={`/api/admin/export/subscribers${qs(sp, { page: undefined, msg: undefined })}`} className="btn-a">Export CSV</a>} />
      <Banner sp={sp} />
      <Card pad={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <form className="flex-1"><input name="q" defaultValue={one(sp.q)} placeholder="Search email" className="in-a" /></form>
          <form id="subs" action={deleteSubscriber}><ConfirmButton message="Delete selected subscribers?">Delete selected</ConfirmButton></form>
        </div>
        {rows.length === 0 ? <EmptyState title="No subscribers yet" /> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr><th className={`${th} w-8`}><SelectAll formId="subs" /></th><th className={th}>Email</th><th className={th}>Language</th><th className={th}>Source</th><th className={th}>Subscribed</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className={td}><input type="checkbox" name="ids" value={r.id} form="subs" className="accent-slate-900" /></td>
                  <td className={td}>{r.email}</td>
                  <td className={td}><Badge>{r.locale.toUpperCase()}</Badge></td>
                  <td className={td}>{r.source}</td>
                  <td className={`${td} text-slate-600`}>{r.createdAt.toLocaleDateString("en-AE", { dateStyle: "medium" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} pageSize={PAGE} total={total} makeHref={(p) => `/admin/subscribers${qs(sp, { page: p, msg: undefined })}`} />
      </Card>
    </>
  );
}

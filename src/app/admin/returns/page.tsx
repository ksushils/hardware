import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { Card, EmptyState, PageHeader, Pagination, StatusBadge, Tabs, td, th } from "@/components/admin/ui";
import { Banner, one, qs, type SP } from "@/components/admin/sales/queries";

export const metadata = { title: "Returns" };
const PAGE = 25;
const TABS = ["ALL", "REQUESTED", "APPROVED", "RECEIVED", "REFUNDED", "REJECTED"];

export default async function ReturnsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePermission("orders");
  const sp = await searchParams;
  const status = one(sp.status) || "ALL";
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const where = status === "ALL" ? {} : { status };
  const [rows, total, counts] = await Promise.all([
    db.returnRequest.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { order: { select: { number: true, fullName: true, email: true } } } }),
    db.returnRequest.count({ where }),
    db.returnRequest.groupBy({ by: ["status"], _count: true }),
  ]);
  const count = (s: string) => (s === "ALL" ? counts.reduce((a, c) => a + c._count, 0) : counts.find((c) => c.status === s)?._count ?? 0);
  return (
    <>
      <PageHeader title="Returns" subtitle="Return requests submitted by customers from their account." />
      <Banner sp={sp} />
      <Card pad={false}>
        <Tabs current={status} tabs={TABS.map((t) => ({ key: t, label: t === "ALL" ? "All" : t[0] + t.slice(1).toLowerCase(), count: count(t), href: `/admin/returns${t === "ALL" ? "" : `?status=${t}`}` }))} />
        {rows.length === 0 ? <EmptyState title="No returns" description="Return requests from customers will appear here." /> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr><th className={th}>Requested</th><th className={th}>Order</th><th className={th}>Customer</th><th className={th}>Reason</th><th className={th}>Items</th><th className={th}>Status</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                let n = 0;
                try { n = (JSON.parse(r.items) as { quantity: number }[]).reduce((s, i) => s + i.quantity, 0); } catch { /* */ }
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className={td}><Link href={`/admin/returns/${r.id}`} className="font-medium hover:underline">{r.createdAt.toLocaleDateString("en-AE", { dateStyle: "medium" })}</Link></td>
                    <td className={td}><Link href={`/admin/orders/${r.order.number}`} className="text-sky-700 hover:underline">{r.order.number}</Link></td>
                    <td className={td}>{r.order.fullName}<div className="text-xs text-slate-500">{r.order.email}</div></td>
                    <td className={td}>{r.reason}</td>
                    <td className={td}>{n}</td>
                    <td className={td}><StatusBadge status={r.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <Pagination page={page} pageSize={PAGE} total={total} makeHref={(p) => `/admin/returns${qs(sp, { page: p })}`} />
      </Card>
    </>
  );
}

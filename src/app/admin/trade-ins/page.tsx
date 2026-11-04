import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { PageHeader, Card, StatusBadge, Tabs, EmptyState, th, td } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/client";
import { updateTradeIn } from "@/app/actions/admin/tradeins";

export const metadata = { title: "Trade-ins" };
const STATUSES = ["NEW", "QUOTED", "COLLECTED", "PAID", "REJECTED"];

export default async function TradeIns({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requirePermission("orders");
  const { status } = await searchParams;
  const rows = await db.tradeIn.findMany({ where: status ? { status } : {}, orderBy: { createdAt: "desc" }, take: 200 });
  const counts = await db.tradeIn.groupBy({ by: ["status"], _count: true });
  const c = (s: string) => counts.find((x) => x.status === s)?._count ?? 0;
  return (
    <>
      <PageHeader title="Trade-in requests" subtitle="Submitted from the storefront instant estimator (/trade-in). Paid store-credit trade-ins automatically issue a gift card (+10%)." />
      <Card pad={false}>
        <Tabs current={status ?? "all"} tabs={[{ key: "all", label: "All", href: "/admin/trade-ins" }, ...STATUSES.map((s) => ({ key: s, label: s[0] + s.slice(1).toLowerCase(), href: `/admin/trade-ins?status=${s}`, count: c(s) }))]} />
        {rows.length === 0 ? <EmptyState title="No trade-in requests" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50"><tr><th className={th}>Date</th><th className={th}>Customer</th><th className={th}>Item</th><th className={th}>Estimate</th><th className={th}>Status</th><th className={th}>Update</th></tr></thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className={td}>{r.createdAt.toLocaleDateString("en-AE")}</td>
                    <td className={td}><p className="font-medium">{r.name}</p><p className="text-xs text-slate-500">{r.email} · {r.phone} · {r.emirate}</p></td>
                    <td className={td}><p className="font-medium">{r.model}</p><p className="text-xs text-slate-500">{r.category} · {r.condition}</p>{r.details && <p className="text-xs text-slate-500">“{r.details}”</p>}</td>
                    <td className={td}>AED {r.estimate}<p className="text-xs text-slate-500">{r.payout === "CREDIT" ? "Store credit" : "Bank transfer"}</p></td>
                    <td className={td}><StatusBadge status={r.status === "NEW" ? "PENDING" : r.status === "PAID" ? "PAID" : r.status === "REJECTED" ? "REJECTED" : "OPEN"} /><p className="mt-1 text-xs text-slate-500">{r.status}</p></td>
                    <td className={td}>
                      <form action={updateTradeIn} className="flex min-w-64 flex-col gap-1.5">
                        <input type="hidden" name="id" value={r.id} />
                        <div className="flex gap-1.5">
                          <select name="status" defaultValue={r.status} className="in-a py-1">{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
                          <input name="offer" type="number" step="0.01" defaultValue={r.offer ?? ""} placeholder="Offer AED" className="in-a w-28 py-1" />
                        </div>
                        <input name="staffNote" defaultValue={r.staffNote ?? ""} placeholder="Note" className="in-a py-1" />
                        <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" name="notify" defaultChecked /> Email customer</label>
                        <SubmitButton className="btn-a">Save</SubmitButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { Card, PageHeader, Pagination, th, td } from "@/components/admin/ui";

export const metadata = { title: "Activity log" };
const PAGE = 50;

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ type?: string; page?: string; user?: string }> }) {
  await requirePermission("settings");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = { ...(sp.type ? { entityType: sp.type } : {}), ...(sp.user ? { userName: sp.user } : {}) };
  const [logs, total, types] = await Promise.all([
    db.activityLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
    db.activityLog.count({ where }),
    db.activityLog.findMany({ select: { entityType: true }, distinct: ["entityType"], orderBy: { entityType: "asc" } }),
  ]);
  const href = (p: Record<string, string | undefined>) => {
    const q = new URLSearchParams(Object.entries({ type: sp.type, user: sp.user, ...p }).filter(([, v]) => v) as [string, string][]);
    return `/admin/settings/activity${q.size ? `?${q}` : ""}`;
  };
  return (
    <div className="space-y-5">
      <PageHeader title="Activity log" back="/admin/settings" subtitle="Every change made by staff in the admin" />
      <div className="flex flex-wrap gap-1 text-sm">
        <Link href={href({ type: undefined, page: undefined })} className={`rounded-lg px-3 py-1.5 ${!sp.type ? "bg-slate-900 text-white" : "bg-white text-slate-700 shadow-sm"}`}>All</Link>
        {types.map((t) => <Link key={t.entityType} href={href({ type: t.entityType, page: undefined })} className={`rounded-lg px-3 py-1.5 capitalize ${sp.type === t.entityType ? "bg-slate-900 text-white" : "bg-white text-slate-700 shadow-sm"}`}>{t.entityType}</Link>)}
      </div>
      <Card pad={false}>
        {logs.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">No activity recorded.</p> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr><th className={th}>When</th><th className={th}>Staff</th><th className={th}>Type</th><th className={th}>Action</th><th className={th}>Details</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className={`${td} whitespace-nowrap text-slate-500`}>{l.createdAt.toLocaleString("en-AE", { dateStyle: "medium", timeStyle: "short" })}</td>
                  <td className={td}>{l.userName ? <Link href={href({ user: l.userName, page: undefined })} className="hover:underline">{l.userName}</Link> : "System"}</td>
                  <td className={`${td} capitalize`}>{l.entityType}</td>
                  <td className={`${td} capitalize`}>{l.action}</td>
                  <td className={td}>{l.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} pageSize={PAGE} total={total} makeHref={(n) => href({ page: String(n) })} />
      </Card>
    </div>
  );
}

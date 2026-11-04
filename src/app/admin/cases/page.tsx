import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { Card, EmptyState, PageHeader, Pagination, Tabs, th, td } from "@/components/admin/ui";
import { CaseStatusBadge, SlaBadge } from "@/components/cases/badges";
import { CASE_TYPES, STAFF_ATTENTION, slaState, typeLabel } from "@/lib/caseLabels";

export const metadata = { title: "Support cases" };
const PAGE = 25;
type SP = { tab?: string; type?: string; seller?: string; assigned?: string; overdue?: string; q?: string; page?: string };

export default async function AdminCases({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePermission("orders");
  const sp = await searchParams;
  const tab = sp.tab ?? "attention";
  const now = new Date();
  const and: Prisma.SupportCaseWhereInput[] = [];
  const tabWhere: Record<string, Prisma.SupportCaseWhereInput> = {
    attention: { status: { in: STAFF_ATTENTION } }, awaiting_seller: { status: "AWAITING_SELLER" }, awaiting_buyer: { status: "AWAITING_BUYER" }, proposed: { status: "PROPOSED" },
    escalated: { status: "ESCALATED" }, closed: { status: { in: ["RESOLVED", "CLOSED"] } }, all: {},
  };
  and.push(tabWhere[tab] ?? {});
  if (sp.type) and.push({ type: sp.type });
  if (sp.seller) and.push({ sellerId: sp.seller });
  if (sp.assigned === "me") and.push({ assignedTo: user.id });
  if (sp.assigned === "none") and.push({ assignedTo: null });
  if (sp.overdue === "1") and.push({ OR: [{ status: "ESCALATED" }, { status: "AWAITING_SELLER", sellerDueAt: { lt: now } }] });
  if (sp.q?.trim()) {
    const q = sp.q.trim();
    and.push({ OR: [{ number: { contains: q.toUpperCase() } }, { email: { contains: q.toLowerCase() } }, { order: { number: { contains: q.toUpperCase() } } }] });
  }
  const where: Prisma.SupportCaseWhereInput = { AND: and };
  const page = Math.max(1, Number(sp.page) || 1);
  const [cases, total, counts, sellers] = await Promise.all([
    db.supportCase.findMany({
      where, orderBy: [{ updatedAt: "desc" }], skip: (page - 1) * PAGE, take: PAGE,
      include: { order: { select: { number: true } }, seller: { select: { shopName: true } } },
    }),
    db.supportCase.count({ where }),
    db.supportCase.groupBy({ by: ["status"], _count: true }),
    db.seller.findMany({ select: { id: true, shopName: true }, orderBy: { shopName: "asc" } }),
  ]);
  const assignees = await db.user.findMany({ where: { id: { in: cases.map((c) => c.assignedTo).filter((x): x is string => !!x) } }, select: { id: true, name: true } });
  const n = (...s: string[]) => counts.filter((c) => s.includes(c.status)).reduce((a, c) => a + c._count, 0);
  const href = (patch: Partial<SP>) => `/admin/cases?${new URLSearchParams(Object.entries({ ...sp, page: undefined, ...patch }).filter(([, v]) => v) as [string, string][])}`;

  return (
    <>
      <PageHeader title="Support cases" subtitle="Buyer, seller and Karat in one place. Sellers have 2 working days to respond; overdue cases escalate automatically." />
      <Card pad={false}>
        <Tabs current={tab} tabs={[
          { key: "attention", label: "Needs attention", count: n(...STAFF_ATTENTION), href: href({ tab: "attention" }) },
          { key: "escalated", label: "Escalated", count: n("ESCALATED"), href: href({ tab: "escalated" }) },
          { key: "awaiting_seller", label: "Awaiting seller", count: n("AWAITING_SELLER"), href: href({ tab: "awaiting_seller" }) },
          { key: "awaiting_buyer", label: "Awaiting buyer", count: n("AWAITING_BUYER"), href: href({ tab: "awaiting_buyer" }) },
          { key: "proposed", label: "Proposed", count: n("PROPOSED"), href: href({ tab: "proposed" }) },
          { key: "closed", label: "Resolved", count: n("RESOLVED", "CLOSED"), href: href({ tab: "closed" }) },
          { key: "all", label: "All", href: href({ tab: "all" }) },
        ]} />
        <form className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <input type="hidden" name="tab" value={tab} />
          <input name="q" defaultValue={sp.q} placeholder="Case, order or email" className="in-a w-56" />
          <select name="type" defaultValue={sp.type ?? ""} className="in-a w-48"><option value="">All types</option>{CASE_TYPES.map((t) => <option key={t} value={t}>{typeLabel(t, "en")}</option>)}</select>
          <select name="seller" defaultValue={sp.seller ?? ""} className="in-a w-44"><option value="">All sellers</option>{sellers.map((s) => <option key={s.id} value={s.id}>{s.shopName}</option>)}</select>
          <select name="assigned" defaultValue={sp.assigned ?? ""} className="in-a w-40"><option value="">Anyone</option><option value="me">Assigned to me</option><option value="none">Unassigned</option></select>
          <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="overdue" value="1" defaultChecked={sp.overdue === "1"} /> Overdue / escalated</label>
          <button className="btn-a">Filter</button>
        </form>
        {cases.length ? (
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50"><tr><th className={th}>Case</th><th className={th}>Type</th><th className={th}>Order</th><th className={th}>Seller</th><th className={th}>Buyer</th><th className={th}>Status</th><th className={th}>SLA</th><th className={th}>Assigned</th><th className={th}>Updated</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {cases.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className={td}><Link href={`/admin/cases/${c.number}`} className="font-semibold hover:underline">{c.number}</Link></td>
                  <td className={td}>{typeLabel(c.type, "en")}</td>
                  <td className={td}>{c.order?.number ?? "—"}</td>
                  <td className={td}>{c.seller?.shopName ?? "Store"}</td>
                  <td className={td}>{c.email}</td>
                  <td className={td}><CaseStatusBadge status={c.status} /></td>
                  <td className={td}><SlaBadge sla={slaState(c)} /></td>
                  <td className={td}>{assignees.find((a) => a.id === c.assignedTo)?.name ?? <span className="text-slate-400">—</span>}</td>
                  <td className={td}>{c.updatedAt.toLocaleDateString("en-AE")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState title="No cases match" description="Cases opened from the storefront's “Report a problem” appear here." />}
        <Pagination page={page} pageSize={PAGE} total={total} makeHref={(p) => href({ page: String(p) })} />
      </Card>
    </>
  );
}

import Link from "next/link";
import { db } from "@/lib/db";
import { requireSeller } from "@/lib/sellerAuth";
import { Card, EmptyState, PageHeader, Tabs, th, td } from "@/components/admin/ui";
import { CaseStatusBadge, SlaBadge } from "@/components/cases/badges";
import { slaState, typeLabel } from "@/lib/caseLabels";

export const metadata = { title: "Support cases" };

export default async function SellerCases({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { seller } = await requireSeller();
  const tab = (await searchParams).tab ?? "action";
  const where = tab === "action" ? { status: { in: ["AWAITING_SELLER", "PROPOSED"] } } : tab === "active" ? { status: { notIn: ["RESOLVED", "CLOSED"] } } : tab === "closed" ? { status: { in: ["RESOLVED", "CLOSED"] } } : {};
  // explicit select: buyer email and internal data are never loaded for sellers
  const [cases, counts] = await Promise.all([
    db.supportCase.findMany({
      where: { sellerId: seller.id, ...where }, orderBy: [{ sellerDueAt: "asc" }, { updatedAt: "desc" }], take: 200,
      select: { number: true, type: true, status: true, sellerDueAt: true, escalateAt: true, updatedAt: true, quantity: true, policySnapshot: true, order: { select: { number: true, fullName: true } } },
    }),
    db.supportCase.groupBy({ by: ["status"], where: { sellerId: seller.id }, _count: true }),
  ]);
  const n = (...s: string[]) => counts.filter((c) => s.includes(c.status)).reduce((a, c) => a + c._count, 0);
  return (
    <>
      <PageHeader title="Support cases" subtitle="Buyer problems about your items. Please respond within 2 working days; unanswered cases are escalated to Karat support." />
      <Card pad={false}>
        <Tabs current={tab} tabs={[
          { key: "action", label: "Action needed", count: n("AWAITING_SELLER", "PROPOSED"), href: "/seller/cases?tab=action" },
          { key: "active", label: "All open", count: n("OPEN", "AWAITING_SELLER", "AWAITING_BUYER", "IN_REVIEW", "PROPOSED", "ESCALATED"), href: "/seller/cases?tab=active" },
          { key: "closed", label: "Resolved", count: n("RESOLVED", "CLOSED"), href: "/seller/cases?tab=closed" },
          { key: "all", label: "All", href: "/seller/cases?tab=all" },
        ]} />
        {cases.length ? (
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50"><tr><th className={th}>Case</th><th className={th}>Issue</th><th className={th}>Order</th><th className={th}>Buyer</th><th className={th}>Status</th><th className={th}>Deadline</th><th className={th}>Updated</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {cases.map((c) => {
                let item = "";
                try { item = JSON.parse(c.policySnapshot ?? "{}").item?.name ?? ""; } catch { /* */ }
                return (
                  <tr key={c.number} className="hover:bg-slate-50">
                    <td className={td}><Link href={`/seller/cases/${c.number}`} className="font-semibold hover:underline">{c.number}</Link></td>
                    <td className={td}>{typeLabel(c.type, "en")}{item && <span className="block text-xs text-slate-500">{item}{c.quantity && c.quantity > 1 ? ` × ${c.quantity}` : ""}</span>}</td>
                    <td className={td}>{c.order?.number ?? "—"}</td>
                    <td className={td}>{c.order?.fullName ?? "—"}</td>
                    <td className={td}><CaseStatusBadge status={c.status} audience="seller" /></td>
                    <td className={td}><SlaBadge sla={slaState(c)} /></td>
                    <td className={td}>{c.updatedAt.toLocaleDateString("en-AE")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <EmptyState title={tab === "action" ? "Nothing needs your attention" : "No cases here"} description="When a buyer reports a problem with one of your items, it will appear here." />}
      </Card>
    </>
  );
}

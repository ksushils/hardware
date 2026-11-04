import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { aed } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader, Tabs, td, th } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/client";
import { Banner, discountStatus, one, type SP } from "@/components/admin/sales/queries";
import { toggleDiscount } from "@/app/actions/admin/discounts";

export const metadata = { title: "Discounts" };

const typeLabel = (d: { type: string; value: number; buyQty: number | null; getQty: number | null }) =>
  d.type === "PERCENT" ? `${d.value}% off` : d.type === "FIXED" ? `${aed(d.value)} off` : d.type === "FREE_SHIPPING" ? "Free shipping" : `Buy ${d.buyQty} get ${d.getQty}${d.value >= 100 ? " free" : ` at ${d.value}% off`}`;

export default async function DiscountsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePermission("discounts");
  const sp = await searchParams;
  const tab = one(sp.tab) || "all";
  const q = one(sp.q).trim();
  const all = await db.discount.findMany({ orderBy: { createdAt: "desc" } });
  const list = all.filter((d) => {
    const st = discountStatus(d).label;
    if (tab === "active" && st !== "Active") return false;
    if (tab === "scheduled" && st !== "Scheduled") return false;
    if (tab === "expired" && !["Expired", "Inactive", "Limit reached"].includes(st)) return false;
    if (q && !`${d.title} ${d.code ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  return (
    <>
      <PageHeader title="Discounts" actions={<Link href="/admin/discounts/new" className="btn-a-primary">Create discount</Link>} />
      <Banner sp={sp} />
      <Card pad={false}>
        <Tabs current={tab} tabs={[["all", "All"], ["active", "Active"], ["scheduled", "Scheduled"], ["expired", "Expired / inactive"]].map(([k, l]) => ({ key: k, label: l, href: `/admin/discounts${k === "all" ? "" : `?tab=${k}`}` }))} />
        <form className="border-b border-slate-100 p-3">{tab !== "all" && <input type="hidden" name="tab" value={tab} />}<input name="q" defaultValue={q} placeholder="Search discounts" className="in-a" /></form>
        {list.length === 0 ? <EmptyState title="No discounts" description="Create codes or automatic discounts to drive sales." action={<Link href="/admin/discounts/new" className="btn-a-primary">Create discount</Link>} /> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr><th className={th}>Title</th><th className={th}>Status</th><th className={th}>Method</th><th className={th}>Type</th><th className={th}>Used</th><th className={th}></th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((d) => {
                const st = discountStatus(d);
                return (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className={td}>
                      <Link href={`/admin/discounts/${d.id}`} className="font-medium hover:underline">{d.code ? <span className="font-mono">{d.code}</span> : d.title}</Link>
                      <div className="text-xs text-slate-500">{d.code ? d.title : ""}{d.minType === "AMOUNT" ? ` · min ${aed(d.minValue)}` : d.minType === "QUANTITY" ? ` · min ${d.minValue} items` : ""}{d.endsAt ? ` · ends ${d.endsAt.toLocaleDateString("en-AE")}` : ""}</div>
                    </td>
                    <td className={td}><Badge tone={st.tone}>{st.label}</Badge></td>
                    <td className={td}>{d.method === "CODE" ? "Code" : "Automatic"}</td>
                    <td className={td}>{typeLabel(d)}{d.appliesTo !== "ALL" && <span className="text-xs text-slate-500"> · {d.targetIds.split(",").filter(Boolean).length} {d.appliesTo.toLowerCase()}</span>}</td>
                    <td className={td}>{d.usedCount}{d.usageLimit != null ? ` / ${d.usageLimit}` : ""}</td>
                    <td className={`${td} text-end`}><form action={toggleDiscount}><input type="hidden" name="id" value={d.id} /><SubmitButton className="btn-a">{d.active ? "Deactivate" : "Activate"}</SubmitButton></form></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

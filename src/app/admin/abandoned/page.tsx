import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { aed } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader, Pagination, Stat, td, th } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/client";
import { SelectAll } from "@/components/admin/sales/client";
import { Banner, one, qs, type SP } from "@/components/admin/sales/queries";
import { deleteCheckouts, sendRecoveryEmails } from "@/app/actions/admin/abandoned";

export const metadata = { title: "Abandoned checkouts" };
const PAGE = 25;

export default async function AbandonedPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePermission("orders");
  const sp = await searchParams;
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const hourAgo = new Date(Date.now() - 3600_000);
  const where = { recoveredOrder: null, email: { not: null }, updatedAt: { lt: hourAgo } };
  const [rows, total, recovered, potential] = await Promise.all([
    db.checkout.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
    db.checkout.count({ where }),
    db.checkout.count({ where: { recoveredOrder: { not: null }, reminderSentAt: { not: null } } }),
    db.checkout.aggregate({ where, _sum: { subtotal: true } }),
  ]);
  const parse = (s: string): { v: string; q: number }[] => { try { const x = JSON.parse(s); return Array.isArray(x) ? x : []; } catch { return []; } };
  const ids = [...new Set(rows.flatMap((r) => parse(r.items).map((i) => i.v)))];
  const variants = await db.variant.findMany({ where: { id: { in: ids } }, include: { product: { select: { name: true, brand: true } } } });
  const vName = (id: string) => { const v = variants.find((x) => x.id === id); return v ? `${v.product.brand} ${v.product.name}${v.title !== "Default Title" ? ` (${v.title})` : ""}` : "Removed product"; };

  return (
    <>
      <PageHeader title="Abandoned checkouts" subtitle="Shoppers who entered their email at checkout but didn't complete their order (more than 1 hour ago)." />
      <Banner sp={sp} />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Abandoned checkouts" value={total} />
        <Stat label="Potential revenue" value={aed(potential._sum.subtotal ?? 0)} />
        <Stat label="Recovered after reminder" value={recovered} />
      </div>
      <Card pad={false}>
        <form id="ab" className="flex flex-wrap gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
          <SubmitButton formAction={sendRecoveryEmails} className="btn-a-primary" pendingText="Sending…">Send recovery email to selected</SubmitButton>
          <SubmitButton formAction={deleteCheckouts} className="btn-a-danger" pendingText="Deleting…">Delete selected</SubmitButton>
        </form>
        {rows.length === 0 ? <EmptyState title="No abandoned checkouts" description="When shoppers leave checkout without paying, they'll show up here so you can follow up." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50"><tr><th className={`${th} w-8`}><SelectAll formId="ab" /></th><th className={th}>Date</th><th className={th}>Customer</th><th className={th}>Items</th><th className={th}>Subtotal</th><th className={th}>Recovery email</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className={td}><input type="checkbox" name="ids" value={r.id} form="ab" className="accent-slate-900" /></td>
                    <td className={`${td} whitespace-nowrap text-slate-600`}>{r.updatedAt.toLocaleString("en-AE", { dateStyle: "medium", timeStyle: "short" })}</td>
                    <td className={td}>{r.email}{r.locale === "ar" && <span className="ms-1"><Badge>AR</Badge></span>}</td>
                    <td className={td}><ul className="space-y-0.5 text-xs">{parse(r.items).map((i) => <li key={i.v}>{vName(i.v)} × {i.q}</li>)}</ul></td>
                    <td className={td}>{aed(r.subtotal)}</td>
                    <td className={td}>{r.reminderSentAt ? <Badge tone="blue">Sent {r.reminderSentAt.toLocaleDateString("en-AE")}</Badge> : <Badge tone="yellow">Not sent</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageSize={PAGE} total={total} makeHref={(p) => `/admin/abandoned${qs(sp, { page: p, msg: undefined })}`} />
      </Card>
    </>
  );
}

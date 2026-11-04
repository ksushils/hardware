import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ACCOUNTS } from "@/lib/ledger";
import { PageHeader, Card, Pagination, EmptyState, th, td } from "@/components/admin/ui";
import { money, Mono } from "@/components/ledger/bits";

const PAGE = 50;
const KINDS = ["ORDER_PAID", "REFUND", "PAYOUT", "ADJUSTMENT", "PROVIDER_FEE", "REVERSAL"];
type SP = { account?: string; seller?: string; kind?: string; from?: string; to?: string; ref?: string; page?: string };

function where(sp: SP): Prisma.LedgerTransactionWhereInput {
  const w: Prisma.LedgerTransactionWhereInput = {};
  if (sp.kind) w.kind = sp.kind;
  if (sp.ref) w.OR = [{ refId: { contains: sp.ref } }, { note: { contains: sp.ref } }];
  const created: Prisma.DateTimeFilter = {};
  if (sp.from && !isNaN(+new Date(sp.from))) created.gte = new Date(sp.from);
  if (sp.to && !isNaN(+new Date(sp.to))) created.lt = new Date(+new Date(sp.to) + 86400_000);
  if (Object.keys(created).length) w.createdAt = created;
  if (sp.account || sp.seller) w.lines = { some: { ...(sp.account ? { account: sp.account } : {}), ...(sp.seller ? { sellerId: sp.seller } : {}) } };
  return w;
}

export default async function LedgerExplorer({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const w = where(sp);
  const [rows, total, sellers] = await Promise.all([
    db.ledgerTransaction.findMany({ where: w, include: { lines: true }, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
    db.ledgerTransaction.count({ where: w }),
    db.seller.findMany({ select: { id: true, shopName: true }, orderBy: { shopName: "asc" } }),
  ]);
  const qs = (p: number) => { const u = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]); u.set("page", String(p)); return `/admin/finance/ledger?${u}`; };
  const exportQs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]); exportQs.set("type", "ledger");
  return (
    <>
      <PageHeader title="Ledger explorer" subtitle={`${total} transaction${total === 1 ? "" : "s"}`} actions={<Link href={`/admin/finance/export?${exportQs}`} className="btn-a">Export CSV</Link>} />
      <Card className="mb-4">
        <form className="grid gap-2 md:grid-cols-6">
          <select name="account" defaultValue={sp.account ?? ""} className="in-a"><option value="">All accounts</option>{Object.keys(ACCOUNTS).map((a) => <option key={a}>{a}</option>)}</select>
          <select name="seller" defaultValue={sp.seller ?? ""} className="in-a"><option value="">All sellers</option>{sellers.map((s) => <option key={s.id} value={s.id}>{s.shopName}</option>)}</select>
          <select name="kind" defaultValue={sp.kind ?? ""} className="in-a"><option value="">All kinds</option>{KINDS.map((k) => <option key={k}>{k}</option>)}</select>
          <input type="date" name="from" defaultValue={sp.from} className="in-a" aria-label="From" />
          <input type="date" name="to" defaultValue={sp.to} className="in-a" aria-label="To" />
          <div className="flex gap-2"><input name="ref" defaultValue={sp.ref} placeholder="Reference / note" className="in-a" /><button className="btn-a-primary">Filter</button></div>
        </form>
      </Card>
      <Card pad={false}>
        {rows.length === 0 ? <EmptyState title="No ledger entries match" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50"><tr><th className={th}>Date</th><th className={th}>Kind</th><th className={th}>Reference</th><th className={th}>Description</th><th className={th}>Accounts</th><th className={`${th} text-end`}>Amount</th></tr></thead>
              <tbody className="divide-y">
                {rows.map((t) => {
                  const dr = t.lines.filter((l) => l.amount > 0).reduce((s, l) => s + l.amount, 0);
                  return (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className={`${td} whitespace-nowrap`}>{t.createdAt.toLocaleString("en-AE", { dateStyle: "medium", timeStyle: "short" })}</td>
                      <td className={td}><Link href={`/admin/finance/ledger/${t.id}`} className="font-semibold text-sky-700 underline">{t.kind}</Link></td>
                      <td className={td}><Mono>{t.refType}:{t.refId.slice(0, 10)}</Mono></td>
                      <td className={`${td} max-w-xs truncate`}>{t.note}</td>
                      <td className={td}><span className="text-xs text-slate-500">{[...new Set(t.lines.map((l) => l.account))].join(", ")}</span></td>
                      <td className={`${td} text-end tabular-nums`}>{money(dr)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageSize={PAGE} total={total} makeHref={qs} />
      </Card>
    </>
  );
}

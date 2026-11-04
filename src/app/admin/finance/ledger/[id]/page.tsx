import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge, th, td } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/client";
import { Cr, Dr, Flash, Mono, money, sourceLink } from "@/components/ledger/bits";
import { reverseEntry } from "../../actions";

export default async function LedgerTransactionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const tx = await db.ledgerTransaction.findUnique({ where: { id }, include: { lines: true } });
  if (!tx) notFound();
  const [reversal, original, sellers] = await Promise.all([
    db.ledgerTransaction.findFirst({ where: { kind: "REVERSAL", refType: "LEDGER_TX", refId: tx.id }, select: { id: true } }),
    tx.kind === "REVERSAL" ? db.ledgerTransaction.findUnique({ where: { id: tx.refId }, select: { id: true, kind: true } }) : null,
    db.seller.findMany({ where: { id: { in: tx.lines.map((l) => l.sellerId).filter((x): x is string => !!x) } }, select: { id: true, shopName: true } }),
  ]);
  const orderNumbers: Record<string, string> = {};
  if (tx.refType === "ORDER") { const o = await db.order.findUnique({ where: { id: tx.refId }, select: { number: true } }); if (o) orderNumbers[tx.refId] = o.number; }
  if (tx.refType === "REFUND") { const r = await db.refund.findUnique({ where: { id: tx.refId }, include: { order: { select: { number: true } } } }); if (r) orderNumbers[`refund:${tx.refId}`] = r.order.number; }
  const sum = tx.lines.reduce((s, l) => s + l.amount, 0);
  const dr = tx.lines.filter((l) => l.amount > 0).reduce((s, l) => s + l.amount, 0);
  return (
    <>
      <PageHeader title={<>{tx.kind} <Mono>{tx.id.slice(0, 10)}</Mono></>} back="/admin/finance/ledger" subtitle={tx.note ?? undefined} />
      <Flash msg={sp.msg} error={sp.error} />
      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <Card title="Lines" pad={false}>
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr><th className={th}>Account</th><th className={th}>Seller</th><th className={th}>Memo</th><th className={`${th} text-end`}>Debit</th><th className={`${th} text-end`}>Credit</th></tr></thead>
            <tbody className="divide-y">
              {tx.lines.map((l) => (
                <tr key={l.id}>
                  <td className={td}><Link href={`/admin/finance/ledger?account=${l.account}`} className="font-mono text-xs text-sky-700 underline">{l.account}</Link></td>
                  <td className={td}>{l.sellerId ? sellers.find((s) => s.id === l.sellerId)?.shopName ?? l.sellerId : ""}</td>
                  <td className={`${td} text-slate-500`}>{l.memo}</td>
                  <td className={`${td} text-end`}><Dr v={l.amount} /></td>
                  <td className={`${td} text-end`}><Cr v={l.amount} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 bg-slate-50 font-semibold"><tr><td className={td} colSpan={3}>Total {sum === 0 ? <Badge tone="green">balanced</Badge> : <Badge tone="red">UNBALANCED {money(sum)}</Badge>}</td><td className={`${td} text-end tabular-nums`}>{money(dr)}</td><td className={`${td} text-end tabular-nums`}>{money(dr - sum)}</td></tr></tfoot>
          </table>
        </Card>
        <div className="space-y-5">
          <Card title="Details">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Posted</dt><dd>{tx.createdAt.toLocaleString("en-AE", { dateStyle: "medium", timeStyle: "medium" })}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Source</dt><dd>{sourceLink(tx.kind, tx.refType, tx.refId, orderNumbers)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Currency</dt><dd>{tx.currency}</dd></div>
              {original && <div className="flex justify-between"><dt className="text-slate-500">Reverses</dt><dd><Link href={`/admin/finance/ledger/${original.id}`} className="text-sky-700 underline">{original.kind}</Link></dd></div>}
              {reversal && <div className="flex justify-between"><dt className="text-slate-500">Reversed by</dt><dd><Link href={`/admin/finance/ledger/${reversal.id}`} className="text-sky-700 underline">correcting entry</Link></dd></div>}
            </dl>
          </Card>
          <Card title="Immutable entry">
            <p className="text-sm text-slate-600">This entry can't be edited or deleted. If it is wrong, post a correcting entry: a new journal that exactly negates it. Then post the right entry through the normal flow.</p>
            {tx.kind === "REVERSAL" ? <p className="mt-3 text-sm text-slate-500">A correcting entry can't itself be reversed.</p> : reversal ? <p className="mt-3 text-sm font-medium text-slate-700">Already reversed.</p> : (
              <form action={reverseEntry} className="mt-3 space-y-2">
                <input type="hidden" name="id" value={tx.id} />
                <textarea name="reason" required minLength={5} rows={2} placeholder="Why is this entry being reversed?" className="in-a" />
                <ConfirmButton message="Post a reversing entry for this transaction? This cannot be undone." className="btn-a-danger w-full">Post correcting entry</ConfirmButton>
              </form>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

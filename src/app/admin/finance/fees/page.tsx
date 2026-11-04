import { randomUUID } from "node:crypto";
import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader, Card, Field, Badge, th, td } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/client";
import { Flash, money } from "@/components/ledger/bits";
import { addProviderFee } from "../actions";

export const metadata = { title: "Provider fees" };

export default async function FeesPage({ searchParams }: { searchParams: Promise<{ msg?: string; error?: string }> }) {
  const sp = await searchParams;
  const [fees, reversals] = await Promise.all([
    db.ledgerTransaction.findMany({ where: { kind: "PROVIDER_FEE" }, include: { lines: { where: { account: "PROVIDER_FEES" } } }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.ledgerTransaction.findMany({ where: { kind: "REVERSAL", refType: "LEDGER_TX" }, select: { refId: true } }),
  ]);
  const reversed = new Set(reversals.map((r) => r.refId));
  const key = randomUUID(); // idempotency key: a double-clicked submit can't post the same fee twice
  return (
    <>
      <PageHeader title="Payment-provider fees" subtitle="Record fees your payment provider deducts (Stripe, Tap, PayTabs…). Posts: Dr PROVIDER_FEES, Cr CASH_CLEARING." />
      <Flash msg={sp.msg} error={sp.error} />
      <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
        <Card title="Record a fee">
          <form action={addProviderFee} className="space-y-3">
            <input type="hidden" name="key" value={key} />
            <Field label="Amount (AED)"><input name="amount" type="number" step="0.01" min="0.01" required className="in-a" /></Field>
            <Field label="Note / provider reference"><input name="note" placeholder="e.g. Stripe payout po_123, fees for 1–7 Nov" className="in-a" /></Field>
            <SubmitButton className="btn-a-primary w-full" pendingText="Posting…">Post fee</SubmitButton>
          </form>
        </Card>
        <Card title="Recent fees" pad={false}>
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr><th className={th}>Date</th><th className={th}>Note</th><th className={`${th} text-end`}>Amount</th><th /></tr></thead>
            <tbody className="divide-y">
              {fees.map((f) => (
                <tr key={f.id}>
                  <td className={td}>{f.createdAt.toLocaleDateString("en-AE")}</td>
                  <td className={td}>{f.note}</td>
                  <td className={`${td} text-end tabular-nums`}>{money(f.lines.reduce((s, l) => s + l.amount, 0))}</td>
                  <td className={`${td} text-end`}>{reversed.has(f.id) ? <Badge tone="gray">reversed</Badge> : <Link href={`/admin/finance/ledger/${f.id}`} className="text-xs text-sky-700 underline">Open</Link>}</td>
                </tr>
              ))}
              {!fees.length && <tr><td colSpan={4} className="p-8 text-center text-slate-500">No fees recorded.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}

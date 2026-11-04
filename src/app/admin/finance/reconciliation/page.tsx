import Link from "next/link";
import { reconciliation } from "@/lib/ledgerReports";
import { PageHeader, Card, Badge, EmptyState, th, td } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/client";
import { Flash, money } from "@/components/ledger/bits";
import { postOrderNow, postPayoutNow } from "../actions";

export const metadata = { title: "Reconciliation" };

function Section({ title, count, hint, children }: { title: string; count: number; hint: string; children: React.ReactNode }) {
  return (
    <Card title={<span className="flex items-center gap-2">{title} {count === 0 ? <Badge tone="green">OK</Badge> : <Badge tone="red">{count} to review</Badge>}</span>} pad={false} className="mb-5">
      <p className="border-b border-slate-100 px-4 py-2.5 text-xs text-slate-500">{hint}</p>
      {count === 0 ? <div className="px-4 py-5 text-sm text-slate-500">Nothing to report.</div> : children}
    </Card>
  );
}

export default async function ReconciliationPage({ searchParams }: { searchParams: Promise<{ msg?: string; error?: string }> }) {
  const sp = await searchParams;
  const r = await reconciliation();
  const issues = r.issues;
  return (
    <>
      <PageHeader title="Reconciliation" subtitle={`Checked ${r.generatedAt.toLocaleString("en-AE", { dateStyle: "medium", timeStyle: "short" })}`} actions={<Link href="/admin/finance/export?type=reconciliation" className="btn-a">Export CSV</Link>} />
      <Flash msg={sp.msg} error={sp.error} />
      <div className={`mb-5 rounded-xl px-4 py-3 text-sm font-medium ${issues ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-800"}`}>
        {issues ? `${issues} item${issues === 1 ? "" : "s"} need attention.` : "✓ Everything reconciles: every paid order, refund and payout is in the ledger and the books balance."}
      </div>

      <Section title="Paid orders without a ledger entry" count={r.unposted.length} hint="Orders marked paid whose ORDER_PAID journal is missing (usually a posting error — see the order timeline for LEDGER_ERROR — or an order paid before the ledger existed).">
        <table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className={th}>Order</th><th className={th}>Date</th><th className={th}>Status</th><th className={`${th} text-end`}>Total</th><th /></tr></thead>
          <tbody className="divide-y">{r.unposted.map((o) => (
            <tr key={o.id}><td className={td}><Link href={`/admin/orders/${o.number}`} className="font-semibold text-sky-700 underline">{o.number}</Link></td><td className={td}>{o.createdAt.toLocaleDateString("en-AE")}</td><td className={td}>{o.paymentStatus}</td><td className={`${td} text-end tabular-nums`}>AED {o.total.toFixed(2)}</td>
              <td className={`${td} text-end`}><form action={postOrderNow}><input type="hidden" name="id" value={o.id} /><SubmitButton className="btn-a" pendingText="Posting…">Post now</SubmitButton></form></td></tr>
          ))}</tbody></table>
      </Section>

      <Section title="Ledger cash ≠ order total − refunds" count={r.cashMismatch.length} hint="For each posted order, cash booked in the ledger must equal what the customer paid minus what was refunded. A difference means a refund or payment was changed outside the normal flow.">
        <table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className={th}>Order</th><th className={`${th} text-end`}>Expected</th><th className={`${th} text-end`}>Ledger</th><th className={`${th} text-end`}>Difference</th></tr></thead>
          <tbody className="divide-y">{r.cashMismatch.map((x) => (
            <tr key={x.id}><td className={td}><Link href={`/admin/orders/${x.number}`} className="font-semibold text-sky-700 underline">{x.number}</Link></td><td className={`${td} text-end tabular-nums`}>{money(x.expected)}</td><td className={`${td} text-end tabular-nums`}>{money(x.ledger)}</td><td className={`${td} text-end font-semibold text-red-600 tabular-nums`}>{money(x.ledger - x.expected)}</td></tr>
          ))}</tbody></table>
      </Section>

      <Section title="Paid payouts without a ledger entry" count={r.payoutsUnposted.length} hint="Payouts marked PAID but with no PAYOUT journal.">
        <table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className={th}>Payout</th><th className={th}>Paid</th><th className={`${th} text-end`}>Amount</th><th /></tr></thead>
          <tbody className="divide-y">{r.payoutsUnposted.map((p) => (
            <tr key={p.id}><td className={`${td} font-mono text-xs`}>{p.id.slice(0, 10)}</td><td className={td}>{p.paidAt?.toLocaleDateString("en-AE")}</td><td className={`${td} text-end tabular-nums`}>AED {p.amount.toFixed(2)}</td>
              <td className={`${td} text-end`}><form action={postPayoutNow}><input type="hidden" name="id" value={p.id} /><SubmitButton className="btn-a" pendingText="Posting…">Post now</SubmitButton></form></td></tr>
          ))}</tbody></table>
      </Section>

      <Card title="Seller balances: ledger vs the orders and payouts they come from" pad={false} className="mb-5">
        <p className="border-b border-slate-100 px-4 py-2.5 text-xs text-slate-500">
          <b>Ledger vs sources</b> compares what the ledger says we owe the seller with what their paid orders, payouts and adjustments add up to (an error if different).{" "}
          <b>Seller-balance engine</b> compares the withdrawable-balance records (which only credit earnings on delivery) plus earnings still in transit with the ledger. A difference is a review item, e.g. a refund shared out differently by the two engines.
        </p>
        {r.sellerRows.length === 0 ? <EmptyState title="No seller activity yet" /> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-slate-50"><tr><th className={th}>Seller</th><th className={`${th} text-end`}>Ledger owes</th><th className={`${th} text-end`}>From sources</th><th className={`${th} text-end`}>Diff</th><th className={`${th} text-end`}>Balance records</th><th className={`${th} text-end`}>In transit</th><th className={`${th} text-end`}>Diff</th><th /></tr></thead>
            <tbody className="divide-y">{r.sellerRows.map((s) => (
              <tr key={s.sellerId}>
                <td className={td}><Link href={`/admin/sellers/${s.sellerId}`} className="font-medium text-sky-700 underline">{s.shopName}</Link></td>
                <td className={`${td} text-end tabular-nums`}>{money(s.ledgerPayable)}</td>
                <td className={`${td} text-end tabular-nums`}>{money(s.expected)}</td>
                <td className={`${td} text-end tabular-nums ${s.error ? "font-bold text-red-600" : "text-emerald-700"}`}>{s.diffLedger === 0 ? "✓" : money(s.diffLedger)}</td>
                <td className={`${td} text-end tabular-nums`}>{money(s.sellerBalance)}</td>
                <td className={`${td} text-end tabular-nums`}>{money(s.inTransit)}</td>
                <td className={`${td} text-end tabular-nums ${s.review ? "font-bold text-amber-600" : "text-emerald-700"}`}>{s.diffBalances === 0 ? "✓" : money(s.diffBalances)}</td>
                <td className={`${td} text-end`}><Link href={`/admin/finance/ledger?seller=${s.sellerId}&account=SELLER_PAYABLE`} className="text-xs text-sky-700 underline">Entries</Link></td>
              </tr>
            ))}</tbody></table></div>
        )}
      </Card>

      <Section title="Unbalanced transactions" count={r.unbalanced.length + (r.trialBalanceTotal !== 0 ? 1 : 0)} hint="Every transaction must sum to zero. This list should always be empty; if not, stop payouts and investigate.">
        <ul className="divide-y text-sm">{r.unbalanced.map((u) => <li key={u.transactionId} className="px-4 py-2"><Link href={`/admin/finance/ledger/${u.transactionId}`} className="font-mono text-sky-700 underline">{u.transactionId}</Link> out by {money(u.sum)}</li>)}{r.trialBalanceTotal !== 0 && <li className="px-4 py-2 font-semibold text-red-600">Trial balance total is {money(r.trialBalanceTotal)}, not zero.</li>}</ul>
      </Section>
    </>
  );
}

import Link from "next/link";
import { db } from "@/lib/db";
import { currentMonth, monthLabel, monthSummary, recentMonths, trialBalance } from "@/lib/ledgerReports";
import { PageHeader, Card, Stat, th, td } from "@/components/admin/ui";
import { Cr, Dr, money } from "@/components/ledger/bits";

export default async function FinanceOverview({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams;
  const ym = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month ?? "") ? sp.month! : currentMonth();
  const [tb, ms, sellers] = await Promise.all([trialBalance(), monthSummary(ym), db.seller.findMany({ select: { id: true, shopName: true } })]);
  const name = new Map(sellers.map((s) => [s.id, s.shopName]));
  const balanced = tb.total === 0 && tb.unbalanced.length === 0;
  const totalDr = tb.accounts.reduce((s, a) => s + a.debit, 0), totalCr = tb.accounts.reduce((s, a) => s + a.credit, 0);
  return (
    <>
      <PageHeader
        title="Finance & ledger" subtitle="Double-entry ledger in fils. Entries are never edited — mistakes are corrected with a reversing entry."
        actions={<Link href="/admin/finance/export?type=trial-balance" className="btn-a">Export trial balance CSV</Link>}
      />
      {balanced ? (
        <div className="mb-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">✓ Ledger is balanced: debits equal credits ({money(totalDr)}).</div>
      ) : (
        <div className="mb-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">
          ✕ LEDGER OUT OF BALANCE by {money(tb.total)}{tb.unbalanced.length ? ` — ${tb.unbalanced.length} unbalanced transaction(s): ${tb.unbalanced.slice(0, 3).map((u) => u.transactionId.slice(0, 8)).join(", ")}` : ""}. Stop and investigate before paying out.
        </div>
      )}

      <Card title={`Summary for ${monthLabel(ym)}`} actions={
        <form className="flex items-center gap-2"><select name="month" defaultValue={ym} className="in-a w-auto py-1">{recentMonths(18).map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}</select><button className="btn-a">Show</button></form>
      }>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Orders paid" value={ms.orders} />
          <Stat label="Billed (incl. VAT, before discounts)" value={money(ms.grossBilled)} />
          <Stat label="Cash received" value={money(ms.cashReceived)} sub={`discounts given ${money(ms.discounts)}`} />
          <Stat label="Refunds paid" value={money(ms.refunds)} />
          <Stat label="Store sales (ex-VAT)" value={money(ms.storeSalesNet)} />
          <Stat label="Delivery & COD fees (ex-VAT)" value={money(ms.shippingNet)} />
          <Stat label="Marketplace commission (ex-VAT)" value={money(ms.commissionNet)} />
          <Stat label="VAT collected (net)" value={money(ms.vat)} />
          <Stat label="Owed to sellers (movement)" value={money(ms.sellerPayableMovement)} />
          <Stat label="Payouts sent" value={money(ms.payouts)} />
          <Stat label="Provider fees" value={money(ms.providerFees)} />
          <Stat label="Manual adjustments" value={money(ms.adjustments)} />
        </div>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-[2fr_1fr]">
        <Card title="Trial balance (all time)" pad={false}>
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr><th className={th}>Account</th><th className={`${th} text-end`}>Debit</th><th className={`${th} text-end`}>Credit</th><th className={`${th} text-end`}>Balance</th></tr></thead>
            <tbody className="divide-y">
              {tb.accounts.filter((a) => a.debit || a.credit).map((a) => (
                <tr key={a.account}>
                  <td className={td}><Link href={`/admin/finance/ledger?account=${a.account}`} className="font-mono text-xs text-sky-700 underline">{a.account}</Link><div className="text-xs text-slate-500">{a.description}</div></td>
                  <td className={`${td} text-end`}><Dr v={a.debit} /></td>
                  <td className={`${td} text-end`}><Cr v={-a.credit} /></td>
                  <td className={`${td} text-end font-medium tabular-nums`}>{a.balance === 0 ? "–" : `${money(Math.abs(a.balance))} ${a.balance > 0 ? "Dr" : "Cr"}`}</td>
                </tr>
              ))}
              {!tb.accounts.some((a) => a.debit || a.credit) && <tr><td colSpan={4} className="p-8 text-center text-slate-500">No ledger entries yet. Run <span className="font-mono">scripts/ledger-backfill.ts</span> to post existing paid orders.</td></tr>}
            </tbody>
            <tfoot className="border-t-2 bg-slate-50 font-semibold"><tr><td className={td}>Total</td><td className={`${td} text-end tabular-nums`}>{money(totalDr)}</td><td className={`${td} text-end tabular-nums`}>{money(totalCr)}</td><td className={`${td} text-end tabular-nums`}>{tb.total === 0 ? "0.00 ✓" : money(tb.total)}</td></tr></tfoot>
          </table>
        </Card>
        <Card title="Owed to sellers" pad={false}>
          <table className="w-full text-sm">
            <tbody className="divide-y">
              {tb.sellerPayable.filter((s) => s.sellerId).map((s) => (
                <tr key={s.sellerId}>
                  <td className={td}><Link href={`/admin/sellers/${s.sellerId}`} className="font-medium text-sky-700 underline">{name.get(s.sellerId!) ?? s.sellerId}</Link></td>
                  <td className={`${td} text-end tabular-nums`}>{money(s.owed)}</td>
                  <td className={`${td} text-end`}><Link href={`/admin/finance/statements/${s.sellerId}/${currentMonth()}`} className="text-xs text-sky-700 underline">Statement</Link></td>
                </tr>
              ))}
              {!tb.sellerPayable.some((s) => s.sellerId) && <tr><td className="p-6 text-center text-slate-500">No seller balances.</td></tr>}
            </tbody>
          </table>
          <p className="border-t px-4 py-3 text-xs text-slate-500">Includes earnings still inside the return hold; what a seller can withdraw today is shown in Marketplace → Payouts.</p>
        </Card>
      </div>
    </>
  );
}

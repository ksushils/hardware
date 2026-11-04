import Link from "next/link";
import type { sellerStatement } from "@/lib/ledgerReports";
import { monthLabel, recentMonths } from "@/lib/ledgerReports";
import { Card, th, td } from "@/components/admin/ui";
import { AutoSubmitSelect, PrintButton } from "@/components/admin/client";
import { money } from "./bits";

type Statement = NonNullable<Awaited<ReturnType<typeof sellerStatement>>>;
const KIND_LABEL: Record<string, string> = { SALE: "Sale", REFUND: "Refund", PAYOUT: "Payout", ADJUSTMENT: "Adjustment", REVERSAL: "Correction" };

/** Monthly seller statement. Shared by the seller portal and the admin view; amounts are what TechRevive owes the seller. */
export default function StatementView({ st, storeName, legalName, basePath, csvHref, trn }: { st: Statement; storeName: string; legalName: string; basePath: string; csvHref: string; trn?: string }) {
  const t = st.totals;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <form className="flex items-center gap-2" action={basePath}>
          <label className="text-sm text-slate-600" htmlFor="ym">Month</label>
          <AutoSubmitSelect id="ym" name="ym" defaultValue={st.ym} className="in-a w-auto py-1.5">
            {recentMonths(24).map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </AutoSubmitSelect>
          <noscript><button className="btn-a">Go</button></noscript>
        </form>
        <div className="flex gap-2">
          <Link href={csvHref} className="btn-a">Download CSV</Link>
          <PrintButton />
        </div>
      </div>

      <Card pad={false}>
        <div className="border-b border-slate-100 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Seller statement</p>
              <h1 className="text-xl font-bold">{st.seller.shopName}</h1>
              <p className="text-sm text-slate-600">{monthLabel(st.ym)} · all amounts in AED</p>
              {st.seller.trn && <p className="text-xs text-slate-500">Seller TRN {st.seller.trn}</p>}
            </div>
            <div className="text-end text-sm text-slate-600">
              <p className="font-semibold text-slate-900">{legalName}</p>
              {trn && <p>TRN {trn}</p>}
              <p>{storeName} marketplace</p>
              <p className="text-xs">Generated {new Date().toLocaleDateString("en-AE", { dateStyle: "medium" })}</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px bg-slate-100 text-sm md:grid-cols-4">
          {[
            ["Opening balance", money(st.opening)], ["Net sales credited", money(t.sales)], ["Refunds", money(t.refunds)], ["Adjustments", money(t.adjustments)],
            ["Payouts sent", money(t.payouts)], ["Gross sales", money(t.gross)], ["Commission", money(-t.commission)], ["Delivery fees", money(t.delivery)],
          ].map(([l, v]) => <div key={l} className="bg-white p-4"><p className="text-xs text-slate-500">{l}</p><p className="mt-0.5 text-lg font-semibold tabular-nums">{v}</p></div>)}
        </div>
        <div className="flex items-center justify-between bg-slate-900 px-5 py-3 text-white"><span className="text-sm">Closing balance — owed to you</span><span className="text-xl font-bold tabular-nums">{money(st.closing)}</span></div>
      </Card>

      <Card title={`Transactions (${st.rows.length})`} pad={false}>
        {st.rows.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No activity in {monthLabel(st.ym)}.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50"><tr><th className={th}>Date</th><th className={th}>Type</th><th className={th}>Reference</th><th className={th}>Description</th><th className={`${th} text-end`}>Gross</th><th className={`${th} text-end`}>Commission</th><th className={`${th} text-end`}>Delivery</th><th className={`${th} text-end`}>Amount</th></tr></thead>
              <tbody className="divide-y">
                {st.rows.map((r, i) => (
                  <tr key={i}>
                    <td className={`${td} whitespace-nowrap`}>{r.date.toLocaleDateString("en-AE", { timeZone: "Asia/Dubai", day: "2-digit", month: "short" })}</td>
                    <td className={td}>{KIND_LABEL[r.kind]}</td>
                    <td className={`${td} font-mono text-xs`}>{r.ref}</td>
                    <td className={`${td} max-w-xs text-slate-600`}>{r.description}</td>
                    <td className={`${td} text-end tabular-nums`}>{r.gross !== undefined ? money(r.gross) : ""}</td>
                    <td className={`${td} text-end tabular-nums`}>{r.commission !== undefined ? money(-r.commission) : ""}</td>
                    <td className={`${td} text-end tabular-nums`}>{r.delivery ? money(r.delivery) : ""}</td>
                    <td className={`${td} text-end font-medium tabular-nums ${r.amount < 0 ? "text-red-600" : ""}`}>{money(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 bg-slate-50 font-semibold"><tr><td className={td} colSpan={7}>Closing balance</td><td className={`${td} text-end tabular-nums`}>{money(st.closing)}</td></tr></tfoot>
            </table>
          </div>
        )}
      </Card>
      <p className="text-xs text-slate-500">
        Sales are recorded when the customer&apos;s payment is received. Earnings become withdrawable after the return-hold period shown in your Payouts page.
        Amounts include VAT as charged to the customer; each seller is responsible for their own VAT treatment of their sales. Months run on Dubai time.
      </p>
    </div>
  );
}

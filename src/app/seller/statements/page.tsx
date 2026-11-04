import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSeller } from "@/lib/sellerAuth";
import { monthLabel, recentMonths, sellerStatement } from "@/lib/ledgerReports";
import { PageHeader, Card, th, td } from "@/components/admin/ui";
import { money } from "@/components/ledger/bits";

export const metadata = { title: "Statements" };

export default async function StatementsPage({ searchParams }: { searchParams: Promise<{ ym?: string }> }) {
  const { seller } = await requireSeller();
  const { ym } = await searchParams;
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(ym ?? "")) redirect(`/seller/statements/${ym}`);
  const months = recentMonths(12);
  const statements = await Promise.all(months.map((m) => sellerStatement(seller.id, m)));
  return (
    <>
      <PageHeader title="Statements" subtitle="Monthly statements of what the marketplace owes you: sales, commission, refunds, adjustments and payouts." />
      <Card pad={false}>
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr><th className={th}>Month</th><th className={`${th} text-end`}>Orders</th><th className={`${th} text-end`}>Net sales</th><th className={`${th} text-end`}>Refunds</th><th className={`${th} text-end`}>Payouts</th><th className={`${th} text-end`}>Closing balance</th><th /></tr></thead>
          <tbody className="divide-y">
            {statements.map((st, i) => st && (
              <tr key={months[i]}>
                <td className={`${td} font-medium`}>{monthLabel(months[i])}</td>
                <td className={`${td} text-end tabular-nums`}>{st.orderCount}</td>
                <td className={`${td} text-end tabular-nums`}>{money(st.totals.sales)}</td>
                <td className={`${td} text-end tabular-nums`}>{st.totals.refunds ? money(st.totals.refunds) : "–"}</td>
                <td className={`${td} text-end tabular-nums`}>{st.totals.payouts ? money(st.totals.payouts) : "–"}</td>
                <td className={`${td} text-end font-medium tabular-nums`}>{money(st.closing)}</td>
                <td className={`${td} text-end`}><Link href={`/seller/statements/${months[i]}`} className="font-medium text-violet-700 underline">Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

import { db } from "@/lib/db";
import { requireSeller } from "@/lib/sellerAuth";
import { sellerBalance } from "@/lib/marketplace";
import { getSettings } from "@/lib/settings";
import { Card, PageHeader, Stat, th, td, Badge } from "@/components/admin/ui";

export const metadata = { title: "Earnings" };

export default async function SellerEarnings() {
  const { seller } = await requireSeller();
  const [bal, txns, s] = await Promise.all([
    sellerBalance(seller.id),
    db.sellerTransaction.findMany({ where: { sellerId: seller.id }, orderBy: { createdAt: "desc" }, take: 500 }),
    getSettings(),
  ]);
  const now = new Date();
  return (
    <>
      <PageHeader title="Earnings" subtitle={`Earnings are credited when an order is delivered and become available after ${s.marketplace.holdDays} days.`} actions={<a href="/seller/earnings/export" className="btn-a">Download CSV</a>} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Lifetime net" value={`AED ${bal.total.toLocaleString()}`} />
        <Stat label="Available" value={`AED ${bal.available.toLocaleString()}`} />
        <Stat label="In hold period" value={`AED ${bal.pending.toLocaleString()}`} />
        <Stat label="Payouts in progress" value={`AED ${bal.requested.toLocaleString()}`} />
      </div>
      <Card title="Transactions" pad={false}>
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50"><tr><th className={th}>Date</th><th className={th}>Type</th><th className={th}>Details</th><th className={th}>Amount</th><th className={th}>Available</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {txns.map((t) => (
              <tr key={t.id}>
                <td className={td}>{t.createdAt.toLocaleDateString("en-AE")}</td>
                <td className={td}><Badge tone={t.type === "EARNING" ? "green" : t.type === "PAYOUT" ? "blue" : t.type === "REFUND" ? "red" : "gray"}>{t.type}</Badge></td>
                <td className={td}>{t.note}</td>
                <td className={`${td} font-semibold ${t.amount < 0 ? "text-red-600" : "text-emerald-700"}`}>{t.amount > 0 ? "+" : ""}AED {t.amount.toFixed(2)}</td>
                <td className={td}>{t.availableAt <= now ? "Available" : `From ${t.availableAt.toLocaleDateString("en-AE")}`}</td>
              </tr>
            ))}
            {!txns.length && <tr><td colSpan={5} className="p-6 text-center text-slate-500">No transactions yet. Earnings appear here once your orders are delivered.</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}

import Link from "next/link";
import { db } from "@/lib/db";
import { requireSeller } from "@/lib/sellerAuth";
import { sellerBalance } from "@/lib/marketplace";
import { getSettings } from "@/lib/settings";
import { Card, PageHeader, StatusBadge, th, td } from "@/components/admin/ui";
import PayoutForm from "@/components/marketplace/PayoutForm";

export const metadata = { title: "Payouts" };

export default async function SellerPayouts() {
  const { seller } = await requireSeller();
  const [bal, payouts, s] = await Promise.all([sellerBalance(seller.id), db.payout.findMany({ where: { sellerId: seller.id }, orderBy: { requestedAt: "desc" } }), getSettings()]);
  return (
    <>
      <PageHeader title="Payouts" />
      <Card title={`Available balance: AED ${bal.available.toLocaleString()}`} className="mb-5">
        {seller.iban ? <p className="mb-3 text-sm text-slate-600">Paid by bank transfer to {seller.bankName} · <span className="font-mono">{seller.iban}</span></p> : <p className="mb-3 text-sm text-amber-700">Add your IBAN in <Link href="/seller/settings" className="underline">Shop settings</Link> to withdraw.</p>}
        <PayoutForm available={bal.available} min={s.marketplace.minPayout} />
      </Card>
      <Card title="History" pad={false}>
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50"><tr><th className={th}>Requested</th><th className={th}>Amount</th><th className={th}>Status</th><th className={th}>Reference</th><th className={th}>Paid</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {payouts.map((p) => <tr key={p.id}><td className={td}>{p.requestedAt.toLocaleDateString("en-AE")}</td><td className={td}>AED {p.amount}</td><td className={td}><StatusBadge status={p.status} />{p.adminNote && <p className="text-xs text-slate-500">{p.adminNote}</p>}</td><td className={td}>{p.reference ?? "—"}</td><td className={td}>{p.paidAt?.toLocaleDateString("en-AE") ?? "—"}</td></tr>)}
            {!payouts.length && <tr><td colSpan={5} className="p-6 text-center text-slate-500">No payouts yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}

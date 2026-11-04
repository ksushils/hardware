import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { Card, PageHeader, StatusBadge, Tabs, th, td } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/client";
import Flash from "@/components/marketplace/Flash";
import { sellerBalance } from "@/lib/marketplace";
import { payoutFullBalance, processPayout } from "@/app/actions/admin/sellers";

export const metadata = { title: "Seller payouts" };

export default async function PayoutsPage({ searchParams }: { searchParams: Promise<{ status?: string; msg?: string; error?: string }> }) {
  await requirePermission("sellers");
  const sp = await searchParams;
  const status = sp.status ?? "OPEN";
  const where = status === "OPEN" ? { status: { in: ["REQUESTED", "APPROVED"] } } : status === "ALL" ? {} : { status };
  const [payouts, sellers] = await Promise.all([
    db.payout.findMany({ where, include: { seller: true }, orderBy: { requestedAt: "desc" }, take: 200 }),
    db.seller.findMany({ where: { status: { in: ["APPROVED", "SUSPENDED"] } }, orderBy: { shopName: "asc" } }),
  ]);
  const balances = await Promise.all(sellers.map(async (s) => {
    const [b, agg] = await Promise.all([sellerBalance(s.id), db.sellerOrder.aggregate({ where: { sellerId: s.id, status: { not: "CANCELLED" } }, _sum: { subtotal: true, commissionTotal: true, sellerEarning: true } })]);
    const paid = await db.payout.aggregate({ where: { sellerId: s.id, status: "PAID" }, _sum: { amount: true } });
    return { s, b, total: agg._sum.subtotal ?? 0, admin: agg._sum.commissionTotal ?? 0, sellerShare: agg._sum.sellerEarning ?? 0, paid: paid._sum.amount ?? 0 };
  }));
  return (
    <>
      <PageHeader back="/admin/sellers" title="Seller payouts" subtitle="Earnings become available after delivery plus the hold period. Transfer by bank, then mark the payout as paid with the reference." />
      <Flash msg={sp.msg} error={sp.error} />
      <Card pad={false} className="mb-5">
        <Tabs current={status} tabs={[["OPEN", "Open requests"], ["PAID", "Paid"], ["REJECTED", "Rejected"], ["ALL", "All"]].map(([k, l]) => ({ key: k, label: l, href: `/admin/sellers/payouts?status=${k}` }))} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50"><tr><th className={th}>Requested</th><th className={th}>Seller</th><th className={th}>Amount</th><th className={th}>Bank</th><th className={th}>Status</th><th className={th}>Action</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {payouts.map((p) => (
                <tr key={p.id} className="align-top">
                  <td className={td}>{p.requestedAt.toLocaleDateString("en-AE")}</td>
                  <td className={td}><Link href={`/admin/sellers/${p.sellerId}`} className="font-medium hover:underline">{p.seller.shopName}</Link></td>
                  <td className={`${td} font-semibold`}>AED {p.amount.toLocaleString()}</td>
                  <td className={td}><span className="text-xs">{p.seller.bankName} · {p.seller.accountName}<br /><span className="font-mono">{p.seller.iban ?? "No IBAN"}</span></span></td>
                  <td className={td}><StatusBadge status={p.status} />{p.reference && <p className="text-xs text-slate-500">Ref {p.reference}</p>}{p.adminNote && <p className="text-xs text-slate-500">{p.adminNote}</p>}</td>
                  <td className={td}>
                    {["REQUESTED", "APPROVED"].includes(p.status) ? (
                      <div className="space-y-1.5">
                        {p.status === "REQUESTED" && <form action={processPayout}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="action" value="approve" /><SubmitButton className="btn-a w-full">Approve</SubmitButton></form>}
                        <form action={processPayout} className="flex gap-1"><input type="hidden" name="id" value={p.id} /><input type="hidden" name="action" value="paid" /><input name="reference" placeholder="Transfer ref" className="in-a w-28 py-1" required /><SubmitButton className="btn-a-primary">Mark paid</SubmitButton></form>
                        <form action={processPayout} className="flex gap-1"><input type="hidden" name="id" value={p.id} /><input type="hidden" name="action" value="reject" /><input name="note" placeholder="Reason" className="in-a w-28 py-1" /><SubmitButton className="btn-a-danger">Reject</SubmitButton></form>
                      </div>
                    ) : "—"}
                  </td>
                </tr>
              ))}
              {!payouts.length && <tr><td colSpan={6} className="p-6 text-center text-slate-500">No payouts.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Seller income overview" pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50"><tr><th className={th}>Seller</th><th className={th}>Total sales</th><th className={th}>Commission</th><th className={th}>Seller share</th><th className={th}>Paid out</th><th className={th}>Available</th><th className={th}>In hold</th><th className={th} /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {balances.map(({ s, b, total, admin, sellerShare, paid }) => (
                <tr key={s.id}>
                  <td className={td}><Link href={`/admin/sellers/${s.id}`} className="font-medium hover:underline">{s.shopName}</Link></td>
                  <td className={td}>AED {total.toLocaleString()}</td><td className={td}>AED {admin.toLocaleString()}</td><td className={td}>AED {sellerShare.toLocaleString()}</td>
                  <td className={td}>AED {paid.toLocaleString()}</td><td className={`${td} font-semibold`}>AED {b.available.toLocaleString()}</td><td className={td}>AED {b.pending.toLocaleString()}</td>
                  <td className={td}>{b.available > 0 && <form action={payoutFullBalance}><input type="hidden" name="sellerId" value={s.id} /><SubmitButton className="btn-a">Pay out balance</SubmitButton></form>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

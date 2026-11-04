import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { Card, EmptyState, PageHeader, Pagination, StatusBadge, Tabs, Stat, th, td } from "@/components/admin/ui";
import Flash from "@/components/marketplace/Flash";
import { sellerBalance } from "@/lib/marketplace";

export const metadata = { title: "Sellers" };
const PAGE = 25;
type SP = { status?: string; q?: string; page?: string; msg?: string; error?: string };

export default async function SellersPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePermission("sellers");
  const sp = await searchParams;
  const status = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"].includes(sp.status ?? "") ? sp.status! : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.SellerWhereInput = {};
  if (status) where.status = status;
  if (sp.q) where.OR = [{ shopName: { contains: sp.q } }, { email: { contains: sp.q } }, { slug: { contains: sp.q } }, { tradeLicenseNo: { contains: sp.q } }];
  const [counts, total, sellers, pendingProducts, payoutReq, commission] = await Promise.all([
    db.seller.groupBy({ by: ["status"], _count: true }),
    db.seller.count({ where }),
    db.seller.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { _count: { select: { products: true, orders: true } } } }),
    db.product.count({ where: { sellerId: { not: null }, approvalStatus: "PENDING" } }),
    db.payout.aggregate({ where: { status: { in: ["REQUESTED", "APPROVED"] } }, _sum: { amount: true }, _count: true }),
    db.sellerOrder.aggregate({ where: { status: { not: "CANCELLED" } }, _sum: { commissionTotal: true, subtotal: true } }),
  ]);
  const balances = await Promise.all(sellers.map((s) => sellerBalance(s.id)));
  const c = (s: string) => counts.find((x) => x.status === s)?._count ?? 0;
  const qs = (p: Partial<SP>) => { const u = new URLSearchParams(); for (const [k, v] of Object.entries({ status, q: sp.q, ...p })) if (v) u.set(k, String(v)); return `/admin/sellers?${u}`; };
  return (
    <>
      <PageHeader title="Marketplace sellers" actions={<><Link href="/admin/sellers/products" className="btn-a">Product approvals{pendingProducts ? ` (${pendingProducts})` : ""}</Link><Link href="/admin/sellers/payouts" className="btn-a">Payouts</Link><Link href="/admin/sellers/commission" className="btn-a">Commission</Link><Link href="/become-a-seller" target="_blank" className="btn-a">Seller signup page ↗</Link></>} />
      <Flash msg={sp.msg} error={sp.error} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Approved sellers" value={c("APPROVED")} sub={`${c("PENDING")} awaiting review`} />
        <Stat label="Marketplace sales" value={`AED ${(commission._sum.subtotal ?? 0).toLocaleString()}`} />
        <Stat label="Commission earned" value={`AED ${(commission._sum.commissionTotal ?? 0).toLocaleString()}`} />
        <Stat label="Payouts requested" value={`AED ${(payoutReq._sum.amount ?? 0).toLocaleString()}`} sub={`${payoutReq._count} request(s)`} />
      </div>
      <Card pad={false}>
        <Tabs current={status || "ALL"} tabs={[
          { key: "ALL", label: "All", href: qs({ status: "", page: "" }), count: counts.reduce((s, x) => s + x._count, 0) },
          { key: "PENDING", label: "Pending", href: qs({ status: "PENDING", page: "" }), count: c("PENDING") },
          { key: "APPROVED", label: "Approved", href: qs({ status: "APPROVED", page: "" }), count: c("APPROVED") },
          { key: "SUSPENDED", label: "Suspended", href: qs({ status: "SUSPENDED", page: "" }), count: c("SUSPENDED") },
          { key: "REJECTED", label: "Rejected", href: qs({ status: "REJECTED", page: "" }), count: c("REJECTED") },
        ]} />
        <form className="flex gap-2 border-b border-slate-100 p-3">
          {status && <input type="hidden" name="status" value={status} />}
          <input name="q" defaultValue={sp.q} placeholder="Search shop, email, slug or licence no." className="in-a flex-1" />
          <button className="btn-a">Search</button>
        </form>
        {sellers.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50"><tr><th className={th}>Shop</th><th className={th}>Status</th><th className={th}>Emirate</th><th className={th}>Products</th><th className={th}>Orders</th><th className={th}>Rating</th><th className={th}>Balance</th><th className={th}>Applied</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {sellers.map((s, i) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className={td}><Link href={`/admin/sellers/${s.id}`} className="font-semibold hover:underline">{s.shopName}</Link><p className="text-xs text-slate-500">{s.email}</p></td>
                    <td className={td}><StatusBadge status={s.status} />{s.vacationMode && <span className="ms-1 text-xs">🏖️</span>}</td>
                    <td className={td}>{s.emirate}</td>
                    <td className={td}>{s._count.products}</td>
                    <td className={td}>{s._count.orders}</td>
                    <td className={td}>{s.ratingCount ? `★ ${s.ratingAvg} (${s.ratingCount})` : "—"}</td>
                    <td className={td}>AED {balances[i].available.toLocaleString()}<span className="block text-xs text-slate-400">+{balances[i].pending} pending</span></td>
                    <td className={td}>{s.createdAt.toLocaleDateString("en-AE")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="No sellers yet" description="Share the 'Become a seller' page to invite shops onto the marketplace." />}
        <Pagination page={page} pageSize={PAGE} total={total} makeHref={(p) => qs({ page: String(p) })} />
      </Card>
    </>
  );
}

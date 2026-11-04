import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { Card, PageHeader, StatusBadge, Stat, Field, th, td } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/client";
import Flash from "@/components/marketplace/Flash";
import { resolveCommission, sellerBalance } from "@/lib/marketplace";
import { adjustSellerBalance, setSellerCommission, setSellerStatus, updateSellerProfile, reviewProducts } from "@/app/actions/admin/sellers";

export const metadata = { title: "Seller" };

export default async function SellerDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; error?: string }> }) {
  await requirePermission("sellers");
  const { id } = await params;
  const sp = await searchParams;
  const seller = await db.seller.findUnique({ where: { id }, include: { user: { select: { name: true, email: true, createdAt: true } } } });
  if (!seller) notFound();
  const [bal, products, orders, txns, payouts, sales] = await Promise.all([
    sellerBalance(id),
    db.product.findMany({ where: { sellerId: id }, include: { variants: true }, orderBy: { updatedAt: "desc" } }),
    db.sellerOrder.findMany({ where: { sellerId: id }, include: { order: { select: { number: true, createdAt: true } } }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.sellerTransaction.findMany({ where: { sellerId: id }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.payout.findMany({ where: { sellerId: id }, orderBy: { requestedAt: "desc" }, take: 10 }),
    db.sellerOrder.aggregate({ where: { sellerId: id, status: { not: "CANCELLED" } }, _sum: { subtotal: true, commissionTotal: true } }),
  ]);
  const effective = await resolveCommission({ id: "", categoryId: "", sellerId: id });
  const hid = <input type="hidden" name="id" value={id} />;
  const licenceExpired = seller.tradeLicenseExpiry && seller.tradeLicenseExpiry < new Date();
  return (
    <>
      <PageHeader back="/admin/sellers" title={<span className="flex items-center gap-2">{seller.shopName} <StatusBadge status={seller.status} /></span>} subtitle={<>/{seller.slug} · applied {seller.createdAt.toLocaleDateString("en-AE")} by {seller.user.name} ({seller.user.email})</>}
        actions={seller.status === "APPROVED" ? <Link href={`/sellers/${seller.slug}`} target="_blank" className="btn-a">View shop ↗</Link> : undefined} />
      <Flash msg={sp.msg} error={sp.error} />
      {seller.rejectionReason && seller.status !== "APPROVED" && <p className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">Reason on file: {seller.rejectionReason}</p>}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Sales" value={`AED ${(sales._sum.subtotal ?? 0).toLocaleString()}`} />
        <Stat label="Commission earned" value={`AED ${(sales._sum.commissionTotal ?? 0).toLocaleString()}`} />
        <Stat label="Available balance" value={`AED ${bal.available.toLocaleString()}`} sub={`AED ${bal.pending} in hold period`} />
        <Stat label="Rating" value={seller.ratingCount ? `★ ${seller.ratingAvg}` : "—"} sub={`${seller.ratingCount} review(s)`} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Card title={`Products (${products.length})`} pad={false}>
            {products.length ? (
              <form action={reviewProducts}>
                <input type="hidden" name="return" value={`/admin/sellers/${id}`} />
                <table className="w-full text-sm">
                  <thead className="border-b bg-slate-50"><tr><th className="w-8 px-4" /><th className={th}>Product</th><th className={th}>Approval</th><th className={th}>Stock</th><th className={th}>Price</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {products.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4"><input type="checkbox" name="ids" value={p.id} aria-label={`Select ${p.name}`} /></td>
                        <td className={td}><Link href={`/admin/products/${p.id}`} className="font-medium hover:underline">{p.name}</Link>{p.rejectionReason && <p className="text-xs text-red-600">{p.rejectionReason}</p>}</td>
                        <td className={td}><StatusBadge status={p.approvalStatus} /></td>
                        <td className={td}>{p.variants.reduce((s, v) => s + v.stock, 0)}</td>
                        <td className={td}>{p.variants.length ? `AED ${Math.min(...p.variants.map((v) => v.price))}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex flex-wrap items-center gap-2 border-t p-3">
                  <button name="decision" value="APPROVED" className="btn-a-primary">Approve selected</button>
                  <input name="reason" placeholder="Rejection reason" className="in-a w-64" />
                  <button name="decision" value="REJECTED" className="btn-a-danger">Reject selected</button>
                </div>
              </form>
            ) : <p className="p-4 text-sm text-slate-500">No products yet.</p>}
          </Card>
          <Card title="Recent sub-orders" pad={false}>
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50"><tr><th className={th}>Order</th><th className={th}>Date</th><th className={th}>Status</th><th className={th}>Subtotal</th><th className={th}>Commission</th><th className={th}>Seller earns</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o.id}><td className={td}><Link href={`/admin/orders/${o.order.number}`} className="font-medium hover:underline">{o.order.number}</Link></td><td className={td}>{o.order.createdAt.toLocaleDateString("en-AE")}</td><td className={td}><StatusBadge status={o.status} /></td><td className={td}>AED {o.subtotal}</td><td className={td}>AED {o.commissionTotal}</td><td className={td}>AED {o.sellerEarning}</td></tr>
                ))}
                {!orders.length && <tr><td colSpan={6} className="p-4 text-slate-500">No orders yet.</td></tr>}
              </tbody>
            </table>
          </Card>
          <Card title="Ledger" pad={false}>
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50"><tr><th className={th}>Date</th><th className={th}>Type</th><th className={th}>Note</th><th className={th}>Amount</th><th className={th}>Available</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {txns.map((t) => (
                  <tr key={t.id}><td className={td}>{t.createdAt.toLocaleDateString("en-AE")}</td><td className={td}>{t.type}</td><td className={td}>{t.note}</td><td className={`${td} font-semibold ${t.amount < 0 ? "text-red-600" : "text-emerald-700"}`}>{t.amount > 0 ? "+" : ""}{t.amount.toFixed(2)}</td><td className={td}>{t.availableAt <= new Date() ? "Now" : t.availableAt.toLocaleDateString("en-AE")}</td></tr>
                ))}
                {!txns.length && <tr><td colSpan={5} className="p-4 text-slate-500">No transactions yet.</td></tr>}
              </tbody>
            </table>
            <form action={adjustSellerBalance} className="flex flex-wrap gap-2 border-t p-3">{hid}
              <input name="amount" type="number" step="0.01" placeholder="± AED" className="in-a w-32" required />
              <input name="note" placeholder="Reason (e.g. shipping reimbursement)" className="in-a flex-1" required />
              <SubmitButton className="btn-a">Add adjustment</SubmitButton>
            </form>
          </Card>
          {payouts.length > 0 && (
            <Card title="Payouts">
              <ul className="divide-y text-sm">{payouts.map((p) => <li key={p.id} className="flex justify-between py-2"><span>{p.requestedAt.toLocaleDateString("en-AE")} · AED {p.amount}{p.reference ? ` · ref ${p.reference}` : ""}</span><StatusBadge status={p.status} /></li>)}</ul>
            </Card>
          )}
        </div>
        <div className="space-y-5">
          <Card title="Application status">
            <div className="space-y-2">
              {seller.status !== "APPROVED" && <form action={setSellerStatus}>{hid}<input type="hidden" name="status" value="APPROVED" /><SubmitButton className="btn-a-primary w-full">{seller.status === "SUSPENDED" ? "Reactivate shop" : "Approve seller"}</SubmitButton></form>}
              {seller.status === "PENDING" && (
                <form action={setSellerStatus} className="space-y-2">{hid}<input type="hidden" name="status" value="REJECTED" />
                  <textarea name="reason" placeholder="Reason for rejection (sent to the applicant)" className="in-a" rows={2} required />
                  <SubmitButton className="btn-a-danger w-full">Reject application</SubmitButton>
                </form>
              )}
              {seller.status === "APPROVED" && (
                <form action={setSellerStatus} className="space-y-2">{hid}<input type="hidden" name="status" value="SUSPENDED" />
                  <textarea name="reason" placeholder="Reason for suspension" className="in-a" rows={2} required />
                  <SubmitButton className="btn-a-danger w-full">Suspend shop (hides products)</SubmitButton>
                </form>
              )}
            </div>
          </Card>
          <Card title="Documents & business">
            <dl className="space-y-1.5 text-sm">
              <div><dt className="text-xs text-slate-500">Trade licence</dt><dd>{seller.tradeLicenseNo ?? "—"} {seller.tradeLicenseExpiry && <span className={licenceExpired ? "font-semibold text-red-600" : "text-slate-500"}>(exp. {seller.tradeLicenseExpiry.toLocaleDateString("en-AE")}{licenceExpired ? " — EXPIRED" : ""})</span>}</dd></div>
              {seller.tradeLicenseUrl && <div><a href={seller.tradeLicenseUrl} target="_blank" className="text-sky-700 underline">View licence document ↗</a></div>}
              <div><dt className="text-xs text-slate-500">TRN</dt><dd>{seller.trn ?? "—"}</dd></div>
              <div><dt className="text-xs text-slate-500">Contact</dt><dd>{seller.email} · {seller.phone}</dd></div>
              <div><dt className="text-xs text-slate-500">Address</dt><dd>{seller.address}, {seller.emirate}</dd></div>
              <div><dt className="text-xs text-slate-500">Bank</dt><dd>{seller.bankName ?? "—"} · {seller.accountName ?? ""}<br /><span className="font-mono text-xs">{seller.iban ?? "No IBAN"}</span></dd></div>
            </dl>
          </Card>
          <Card title="Commission override">
            <p className="mb-2 text-xs text-slate-500">Currently: {effective.type === "FIXED" ? `AED ${effective.fixed}/unit` : effective.type === "FIXED_PERCENT" ? `AED ${effective.fixed} + ${effective.percent}%` : `${effective.percent}%`} {seller.commissionType ? "(seller override)" : "(from rules / default; category & product rules can still apply per item)"}</p>
            <form action={setSellerCommission} className="space-y-2">{hid}
              <select name="type" defaultValue={seller.commissionType ?? ""} className="in-a"><option value="">No override (use rules)</option><option value="PERCENT">Percent</option><option value="FIXED">Fixed per unit</option><option value="FIXED_PERCENT">Fixed + percent</option></select>
              <div className="flex gap-2"><input name="percent" type="number" step="0.1" defaultValue={seller.commissionRate ?? ""} placeholder="%" className="in-a" /><input name="fixed" type="number" step="0.01" defaultValue={seller.commissionFixed ?? ""} placeholder="AED" className="in-a" /></div>
              <SubmitButton className="btn-a w-full">Save commission</SubmitButton>
            </form>
          </Card>
          <Card title="Edit profile">
            <form action={updateSellerProfile} className="space-y-2">{hid}
              <Field label="Shop name"><input name="shopName" defaultValue={seller.shopName} className="in-a" /></Field>
              <Field label="Email"><input name="email" defaultValue={seller.email} className="in-a" /></Field>
              <Field label="Phone"><input name="phone" defaultValue={seller.phone} className="in-a" /></Field>
              <Field label="TRN"><input name="trn" defaultValue={seller.trn ?? ""} className="in-a" /></Field>
              <Field label="Trade licence no."><input name="tradeLicenseNo" defaultValue={seller.tradeLicenseNo ?? ""} className="in-a" /></Field>
              <Field label="Licence expiry"><input name="tradeLicenseExpiry" type="date" defaultValue={seller.tradeLicenseExpiry?.toISOString().slice(0, 10)} className="in-a" /></Field>
              <SubmitButton className="btn-a w-full">Save profile</SubmitButton>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}

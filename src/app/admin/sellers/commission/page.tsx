import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Card, PageHeader, Field, th, td, Badge } from "@/components/admin/ui";
import { SubmitButton, ConfirmButton } from "@/components/admin/client";
import Flash from "@/components/marketplace/Flash";
import { deleteCommissionRule, saveCommissionRule, saveMarketplaceSettings } from "@/app/actions/admin/sellers";

export const metadata = { title: "Commission" };

export default async function CommissionPage({ searchParams }: { searchParams: Promise<{ msg?: string; error?: string }> }) {
  await requirePermission("sellers");
  const sp = await searchParams;
  const [rules, categories, sellers, products, s] = await Promise.all([
    db.commissionRule.findMany({ orderBy: { scope: "asc" } }),
    db.category.findMany({ orderBy: { sortOrder: "asc" } }),
    db.seller.findMany({ where: { status: "APPROVED" }, orderBy: { shopName: "asc" } }),
    db.product.findMany({ where: { sellerId: { not: null } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getSettings(),
  ]);
  const m = s.marketplace;
  const target = (r: (typeof rules)[number]) =>
    r.scope === "CATEGORY" ? categories.find((c) => c.id === r.categoryId)?.name : r.scope === "SELLER" ? sellers.find((x) => x.id === r.sellerId)?.shopName : r.scope === "PRODUCT" ? products.find((p) => p.id === r.productId)?.name : "All products";
  const fmtRule = (r: { type: string; percent: number; fixed: number }) => (r.type === "FIXED" ? `AED ${r.fixed} / unit` : r.type === "FIXED_PERCENT" ? `AED ${r.fixed} + ${r.percent}%` : `${r.percent}%`);
  const RuleForm = ({ r }: { r?: (typeof rules)[number] }) => (
    <form action={saveCommissionRule} className="grid gap-2 md:grid-cols-7">
      {r && <input type="hidden" name="id" value={r.id} />}
      <select name="scope" defaultValue={r?.scope ?? "CATEGORY"} className="in-a"><option value="GLOBAL">Global</option><option value="CATEGORY">Category</option><option value="SELLER">Seller</option><option value="PRODUCT">Product</option></select>
      <select name="categoryId" defaultValue={r?.categoryId ?? ""} className="in-a"><option value="">— category —</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <select name="sellerId" defaultValue={r?.sellerId ?? ""} className="in-a"><option value="">— seller —</option>{sellers.map((x) => <option key={x.id} value={x.id}>{x.shopName}</option>)}</select>
      <select name="productId" defaultValue={r?.productId ?? ""} className="in-a"><option value="">— product —</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <select name="type" defaultValue={r?.type ?? "PERCENT"} className="in-a"><option value="PERCENT">Percent</option><option value="FIXED">Fixed / unit</option><option value="FIXED_PERCENT">Fixed + %</option></select>
      <div className="flex gap-1"><input name="percent" type="number" step="0.1" defaultValue={r?.percent ?? 10} className="in-a" aria-label="Percent" /><input name="fixed" type="number" step="0.01" defaultValue={r?.fixed ?? 0} className="in-a" aria-label="Fixed AED" /></div>
      <div className="flex items-center gap-2"><label className="flex items-center gap-1 text-xs"><input type="checkbox" name="active" defaultChecked={r?.active ?? true} /> Active</label><SubmitButton className="btn-a-primary">{r ? "Save" : "Add"}</SubmitButton></div>
    </form>
  );
  return (
    <>
      <PageHeader back="/admin/sellers" title="Commission & marketplace settings" />
      <Flash msg={sp.msg} error={sp.error} />
      <div className="space-y-5">
        <Card title="How commission is calculated">
          <p className="text-sm text-slate-600">For each order line from a marketplace seller, the first match wins: <b>seller override</b> (set on the seller page) → <b>product rule</b> → <b>seller rule</b> → <b>category rule</b> → <b>global rule</b> → default {m.defaultCommissionPercent}%. Commission is taken from the VAT-inclusive item price (Care+ warranty revenue stays with the store) and snapshotted on the order, so later rule changes don&apos;t affect past orders.</p>
        </Card>
        <Card title="Commission rules" pad={false}>
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50"><tr><th className={th}>Scope</th><th className={th}>Applies to</th><th className={th}>Commission</th><th className={th}>Status</th><th className={th} /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rules.map((r) => (
                <tr key={r.id}>
                  <td className={td}><Badge tone="purple">{r.scope}</Badge></td><td className={td}>{target(r) ?? "(deleted)"}</td><td className={`${td} font-semibold`}>{fmtRule(r)}</td>
                  <td className={td}>{r.active ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}</td>
                  <td className={td}>
                    <details><summary className="cursor-pointer text-xs text-sky-700">Edit</summary><div className="mt-2 w-[56rem] max-w-[80vw]"><RuleForm r={r} /></div></details>
                    <form action={deleteCommissionRule} className="mt-1"><input type="hidden" name="id" value={r.id} /><ConfirmButton message="Delete this rule?" className="text-xs text-red-600">Delete</ConfirmButton></form>
                  </td>
                </tr>
              ))}
              {!rules.length && <tr><td colSpan={5} className="p-4 text-slate-500">No rules — the default {m.defaultCommissionPercent}% applies to every marketplace sale.</td></tr>}
            </tbody>
          </table>
          <div className="border-t p-4"><p className="mb-2 text-sm font-semibold">Add rule</p><RuleForm /><p className="mt-1 text-xs text-slate-500">Pick the target matching the scope (ignored for Global).</p></div>
        </Card>
        <Card title="Marketplace settings">
          <form action={saveMarketplaceSettings} className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={m.enabled} /> Accept new seller applications</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="autoApproveSellers" defaultChecked={m.autoApproveSellers} /> Auto-approve new sellers</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="autoApproveProducts" defaultChecked={m.autoApproveProducts} /> Auto-approve seller products</label>
            <span />
            <Field label="Default commission %"><input name="defaultCommissionPercent" type="number" step="0.1" defaultValue={m.defaultCommissionPercent} className="in-a" /></Field>
            <Field label="Minimum payout (AED)"><input name="minPayout" type="number" defaultValue={m.minPayout} className="in-a" /></Field>
            <Field label="Hold period (days after delivery)" help="Covers the return window before earnings can be withdrawn."><input name="holdDays" type="number" defaultValue={m.holdDays} className="in-a" /></Field>
            <span />
            <Field label="Seller terms (English)"><textarea name="sellerTerms" rows={4} defaultValue={m.sellerTerms} className="in-a" /></Field>
            <Field label="Seller terms (Arabic)"><textarea name="sellerTermsAr" rows={4} defaultValue={m.sellerTermsAr} className="in-a" dir="rtl" /></Field>
            <div className="md:col-span-2"><SubmitButton>Save settings</SubmitButton></div>
          </form>
        </Card>
      </div>
    </>
  );
}

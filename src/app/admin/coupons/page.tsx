import { db } from "@/lib/db";
import { aed } from "@/lib/format";
import { toggleCoupon } from "@/app/actions/admin";
import CouponForm from "@/components/admin/CouponForm";

export default async function AdminCoupons() {
  const coupons = await db.coupon.findMany({ orderBy: { code: "asc" } });
  return (
    <div className="space-y-4">
      <CouponForm />
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="p-3">Code</th><th>Discount</th><th>Min spend</th><th>Expires</th><th>Status</th><th></th></tr></thead>
          <tbody className="divide-y">
            {coupons.map((c) => (
              <tr key={c.id}>
                <td className="p-3 font-mono font-bold">{c.code}</td>
                <td>{c.type === "PERCENT" ? `${c.value}%` : aed(c.value)}</td>
                <td>{aed(c.minSpend)}</td>
                <td>{c.expiresAt ? c.expiresAt.toLocaleDateString("en-AE") : "Never"}</td>
                <td>{c.active ? <span className="text-brand-700">Active</span> : <span className="text-slate-400">Disabled</span>}</td>
                <td className="pr-3 text-right"><form action={toggleCoupon}><input type="hidden" name="id" value={c.id} /><button className="font-semibold text-brand-700">{c.active ? "Disable" : "Enable"}</button></form></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

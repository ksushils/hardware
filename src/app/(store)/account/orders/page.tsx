import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n";
import { aed } from "@/lib/format";
import { StatusBadge } from "@/components/OrderView";

export const metadata = { title: "My Orders" };

export default async function OrdersPage() {
  const user = await requireUser("/account/orders");
  const { t, locale } = await getI18n();
  const orders = await db.order.findMany({ where: { userId: user.id, status: { not: "DRAFT" } }, orderBy: { createdAt: "desc" }, include: { _count: { select: { items: true } } } });
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-start text-slate-500"><tr><th className="p-4 text-start">{t.account.order}</th><th className="text-start">{t.account.date}</th><th className="text-start">{t.account.items}</th><th className="text-start">{t.account.total}</th><th className="text-start">{t.account.status}</th><th></th></tr></thead>
        <tbody className="divide-y">
          {orders.map((o) => (
            <tr key={o.id}>
              <td className="p-4 font-semibold" dir="ltr">{o.number}</td>
              <td>{o.createdAt.toLocaleDateString(locale === "ar" ? "ar-AE" : "en-AE")}</td>
              <td>{o._count.items}</td>
              <td>{aed(o.total, locale)}</td>
              <td><StatusBadge status={o.status === "CANCELLED" ? "CANCELLED" : o.fulfillmentStatus} /></td>
              <td className="pe-4 text-end"><Link href={`/order/${o.number}`} className="font-semibold text-brand-700">{t.common.view}</Link></td>
            </tr>
          ))}
          {orders.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">{t.account.noOrdersLong}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

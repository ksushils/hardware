import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n";
import { aed } from "@/lib/format";
import ProfileForm from "@/components/ProfileForm";
import { StatusBadge } from "@/components/OrderView";

export const metadata = { title: "My Account" };

export default async function AccountPage() {
  const user = await requireUser();
  const { t, locale } = await getI18n();
  const [orders, full] = await Promise.all([
    db.order.findMany({ where: { userId: user.id, status: { not: "DRAFT" } }, orderBy: { createdAt: "desc" }, take: 3 }),
    db.user.findUniqueOrThrow({ where: { id: user.id } }),
  ]);
  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex items-center justify-between"><h2 className="text-lg font-bold">{t.account.recentOrders}</h2><Link href="/account/orders" className="text-sm font-semibold text-brand-700">{t.account.viewAll}</Link></div>
        {orders.length === 0 ? <p className="mt-3 text-sm text-slate-500">{t.account.noOrders}</p> : (
          <ul className="mt-3 divide-y">
            {orders.map((o) => (
              <li key={o.id}><Link href={`/order/${o.number}`} className="flex items-center justify-between gap-3 py-3 text-sm hover:bg-slate-50">
                <span className="font-semibold" dir="ltr">{o.number}</span><StatusBadge status={o.status === "CANCELLED" ? "CANCELLED" : o.fulfillmentStatus} /><span>{aed(o.total, locale)}</span>
              </Link></li>
            ))}
          </ul>
        )}
      </div>
      <ProfileForm name={full.name} email={full.email} phone={full.phone ?? ""} locale={full.locale} marketing={full.acceptsMarketing} />
    </div>
  );
}

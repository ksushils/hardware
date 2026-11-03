import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { aed } from "@/lib/format";
import ProfileForm from "@/components/ProfileForm";
import { StatusBadge } from "@/components/OrderView";

export const metadata = { title: "My Account" };

export default async function AccountPage() {
  const user = await requireUser();
  const orders = await db.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 3 });
  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Recent orders</h2><Link href="/account/orders" className="text-sm font-semibold text-brand-700">View all</Link></div>
        {orders.length === 0 ? <p className="mt-3 text-sm text-slate-500">No orders yet.</p> : (
          <ul className="mt-3 divide-y">
            {orders.map((o) => (
              <li key={o.id}><Link href={`/order/${o.number}`} className="flex items-center justify-between py-3 text-sm hover:bg-slate-50">
                <span className="font-semibold">{o.number}</span><StatusBadge status={o.status} /><span>{aed(o.total)}</span>
              </Link></li>
            ))}
          </ul>
        )}
      </div>
      <ProfileForm name={user.name} email={user.email} phone={user.phone ?? ""} />
    </div>
  );
}

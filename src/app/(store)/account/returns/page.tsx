import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n";
import { StatusBadge } from "@/components/OrderView";

export const metadata = { title: "Returns" };

export default async function ReturnsPage() {
  const user = await requireUser("/account/returns");
  const { t, locale } = await getI18n();
  const returns = await db.returnRequest.findMany({ where: { order: { userId: user.id } }, include: { order: true }, orderBy: { createdAt: "desc" } });
  if (!returns.length) return <p className="card p-10 text-center text-slate-500">{t.account.noReturns}</p>;
  return (
    <div className="space-y-3">
      {returns.map((r) => (
        <Link key={r.id} href={`/order/${r.order.number}`} className="card flex items-center justify-between gap-3 p-4 text-sm hover:shadow">
          <div><p className="font-semibold" dir="ltr">{r.order.number}</p><p className="text-slate-500">{r.reason} · {r.createdAt.toLocaleDateString(locale === "ar" ? "ar-AE" : "en-AE")}</p></div>
          <StatusBadge status={r.status} />
        </Link>
      ))}
    </div>
  );
}

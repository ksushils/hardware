import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n";
import { typeLabel } from "@/lib/caseLabels";
import { CaseStatusBadge } from "@/components/cases/badges";

export const metadata: Metadata = { title: "Support cases", robots: { index: false } };

export default async function CasesPage() {
  const user = await requireUser("/account/cases");
  const { locale } = await getI18n();
  const ar = locale === "ar";
  const cases = await db.supportCase.findMany({
    where: { userId: user.id }, orderBy: { updatedAt: "desc" },
    select: { number: true, type: true, status: true, updatedAt: true, createdAt: true, order: { select: { number: true } } },
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">{ar ? "طلبات الدعم" : "Support cases"}</h2>
        <Link href="/account/cases/new" className="btn-primary py-2">{ar ? "الإبلاغ عن مشكلة" : "Report a problem"}</Link>
      </div>
      {cases.length === 0 ? (
        <p className="card p-10 text-center text-slate-500">{ar ? "لا توجد طلبات دعم. إذا واجهت مشكلة في طلبك فسنساعدك." : "No support cases yet. If something's wrong with an order, we're here to help."}</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr><th className="p-4 text-start">{ar ? "الطلب" : "Case"}</th><th className="text-start">{ar ? "النوع" : "Type"}</th><th className="text-start">{ar ? "رقم الطلب" : "Order"}</th><th className="text-start">{ar ? "الحالة" : "Status"}</th><th className="text-start">{ar ? "آخر تحديث" : "Updated"}</th></tr></thead>
            <tbody className="divide-y">
              {cases.map((c) => (
                <tr key={c.number}>
                  <td className="p-4"><Link href={`/account/cases/${c.number}`} className="font-semibold text-brand-700 hover:underline" dir="ltr">{c.number}</Link></td>
                  <td>{typeLabel(c.type, locale)}</td>
                  <td dir="ltr">{c.order?.number ?? "—"}</td>
                  <td><CaseStatusBadge status={c.status} locale={locale} audience="buyer" /></td>
                  <td>{c.updatedAt.toLocaleDateString(ar ? "ar-AE" : "en-AE")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

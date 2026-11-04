import Link from "next/link";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n";
import { canViewOrder } from "@/lib/orders";
import { buildPolicySnapshot } from "@/lib/cases";
import { returnWindowInfo, warrantyInfo } from "@/lib/caseLabels";
import type { SessionUser } from "@/lib/auth";
import NewCaseForm, { type NewCaseOrder } from "./NewCaseForm";

export type NewCaseParams = { order?: string; item?: string; type?: string; k?: string };

/** Shared by /account/cases/new (signed in) and /cases/new?order=…&k=… (guest with an order link). */
export default async function NewCasePage({ user, sp }: { user: SessionUser | null; sp: NewCaseParams }) {
  const { locale } = await getI18n();
  const ar = locale === "ar";
  const orders = user
    ? await db.order.findMany({ where: { userId: user.id, status: { not: "DRAFT" } }, orderBy: { createdAt: "desc" }, take: 20, include: { items: true } })
    : [];
  if (sp.order && !orders.some((o) => o.number === sp.order)) {
    const o = await db.order.findUnique({ where: { number: sp.order }, include: { items: true } });
    if (o && o.status !== "DRAFT" && (await canViewOrder(o, sp.k))) orders.unshift(o);
  }
  if (!orders.length) {
    return (
      <div className="container-x max-w-xl py-16 text-center">
        <h1 className="text-2xl font-black">{ar ? "افتح طلب دعم" : "Open a support case"}</h1>
        <p className="mt-2 text-slate-600">{user ? (ar ? "لا توجد طلبات مرتبطة بحسابك بعد." : "You don't have any orders on your account yet.") : ar ? "افتح هذه الصفحة من الرابط الموجود في بريد طلبك، أو سجّل الدخول." : "Please open this page from the link in your order email, or sign in."}</p>
        <Link href={user ? "/account/orders" : "/login?next=/account/cases/new"} className="btn-primary mt-6">{user ? (ar ? "طلباتي" : "My orders") : ar ? "تسجيل الدخول" : "Sign in"}</Link>
      </div>
    );
  }
  const data: NewCaseOrder[] = [];
  for (const o of orders) {
    const items = [];
    for (const i of o.items) {
      const snap = await buildPolicySnapshot(o, i);
      const w = warrantyInfo(snap), r = returnWindowInfo(snap);
      items.push({
        id: i.id, name: i.name, variantTitle: i.variantTitle, quantity: i.quantity, sellerName: i.sellerName ?? null,
        returnDays: r?.days ?? null, returnDaysLeft: r && r.fromDelivery ? r.daysLeft : null, warrantyMonths: w?.months ?? null, warrantyDaysLeft: w && w.fromDelivery ? w.daysLeft : null,
        delivered: !!snap.deliveredAt,
      });
    }
    data.push({ number: o.number, date: o.createdAt.toLocaleDateString(ar ? "ar-AE" : "en-AE"), items });
  }
  return (
    <div className={user ? "max-w-2xl" : "container-x max-w-2xl py-10"}>
      <h1 className="text-2xl font-black">{ar ? "الإبلاغ عن مشكلة" : "Report a problem"}</h1>
      <p className="mb-5 mt-1 text-slate-600">{ar ? "سنرسل طلبك إلى البائع ونتابعه نحن في Karat حتى يُحل." : "We'll send this to the seller and Karat support will follow it until it's resolved."}</p>
      <NewCaseForm orders={data} k={user ? undefined : sp.k} initial={{ order: sp.order, item: sp.item, type: sp.type }} />
    </div>
  );
}

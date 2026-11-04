import { notFound, redirect } from "next/navigation";
import { canViewOrder, getOrder } from "@/lib/orders";
import { demoPaymentsEnabled, stripeEnabled } from "@/lib/payments";
import { aed } from "@/lib/format";
import { getI18n, fmt } from "@/lib/i18n";
import DemoCardForm from "./DemoCardForm";

export const metadata = { title: "Secure Payment", robots: { index: false } };

export default async function PayPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ k?: string }> }) {
  const { number } = await params;
  const { k } = await searchParams;
  const { t, locale } = await getI18n();
  const order = await getOrder(number);
  if (!order || !(await canViewOrder(order, k))) notFound();
  if (order.paymentStatus === "PAID" || stripeEnabled() || !demoPaymentsEnabled()) redirect(`/order/${number}${k ? `?k=${k}` : ""}`);
  return (
    <div className="container-x max-w-lg py-12">
      <div className="card p-6">
        <p className="text-sm text-slate-500">{fmt(t.pay.order, { n: order.number })}</p>
        <h1 className="text-2xl font-black">{fmt(t.pay.title, { amount: aed(order.total, locale) })}</h1>
        <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800" dir="auto">
          <b>{t.pay.demo}</b> 4242 4242 4242 4242 ✓ · 4000 0000 0000 0002 ✗ · STRIPE_SECRET_KEY → live.
        </div>
        <DemoCardForm number={order.number} total={aed(order.total, locale)} k={k} />
      </div>
    </div>
  );
}

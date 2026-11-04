import Image from "next/image";
import Link from "next/link";
import type { Order, OrderItem, ReturnRequest } from "@prisma/client";
import { aed, EMIRATES_AR } from "@/lib/format";
import { getI18n, fmt } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { cancelOrder, retryPayment } from "@/app/actions/checkout";
import ReturnForm from "./ReturnForm";

const tone: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800", PAID: "bg-emerald-100 text-emerald-800", FAILED: "bg-red-100 text-red-700", REFUNDED: "bg-slate-200 text-slate-700", PARTIALLY_REFUNDED: "bg-amber-100 text-amber-800", VOIDED: "bg-slate-200 text-slate-700",
  UNFULFILLED: "bg-blue-100 text-blue-800", FULFILLED: "bg-indigo-100 text-indigo-800", DELIVERED: "bg-emerald-100 text-emerald-800", RETURNED: "bg-slate-200 text-slate-700",
  CANCELLED: "bg-slate-200 text-slate-700", OPEN: "bg-blue-100 text-blue-800", ARCHIVED: "bg-emerald-100 text-emerald-800", DRAFT: "bg-slate-100",
  REQUESTED: "bg-amber-100 text-amber-800", APPROVED: "bg-blue-100 text-blue-800", REJECTED: "bg-red-100 text-red-700", RECEIVED: "bg-violet-100 text-violet-800",
};

export async function StatusBadge({ status }: { status: string }) {
  const { t } = await getI18n();
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tone[status] ?? "bg-slate-100"}`}>{t.order.statuses[status] ?? status}</span>;
}

export default async function OrderView({ order, actions = true, k }: { order: Order & { items: OrderItem[]; returns?: ReturnRequest[] }; actions?: boolean; k?: string }) {
  const [{ t, locale }, s] = await Promise.all([getI18n(), getSettings()]);
  const cancelled = order.status === "CANCELLED";
  const step = order.fulfillmentStatus === "DELIVERED" ? 2 : order.fulfillmentStatus === "FULFILLED" ? 1 : 0;
  const needsPayment = order.paymentMethod === "CARD" && order.paymentStatus !== "PAID" && !cancelled && order.status !== "DRAFT" ? true : order.status === "DRAFT" && order.paymentMethod === "CARD";
  const cancellable = order.status === "OPEN" && order.paymentStatus !== "PAID" && order.fulfillmentStatus === "UNFULFILLED";
  const deliveredAt = order.deliveredAt ?? (order.fulfillmentStatus === "DELIVERED" ? order.updatedAt : null);
  const canReturn = order.fulfillmentStatus === "DELIVERED" && !cancelled && deliveredAt && Date.now() - deliveredAt.getTime() < s.returnsDays * 86400_000 && !(order.returns ?? []).some((r) => ["REQUESTED", "APPROVED"].includes(r.status));

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">{t.order.number}</p>
            <p className="text-xl font-black" dir="ltr">{order.number}</p>
            <p className="text-sm text-slate-500">{t.order.placed} {order.createdAt.toLocaleString(locale === "ar" ? "ar-AE" : "en-AE", { dateStyle: "medium", timeStyle: "short" })}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {cancelled ? <StatusBadge status="CANCELLED" /> : <StatusBadge status={order.fulfillmentStatus} />}
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">{t.order.payment}: {t.order.statuses[order.paymentStatus] ?? order.paymentStatus}</span>
          </div>
        </div>
        {!cancelled && order.status !== "DRAFT" && (
          <ol className="mt-6 grid grid-cols-3 gap-2 text-center text-xs font-semibold">
            {[t.order.confirmed, t.order.shipped, t.order.delivered].map((label, i) => (
              <li key={label}>
                <div className={`h-2 rounded-full ${i <= step ? "bg-brand-600" : "bg-slate-200"}`} />
                <p className={`mt-2 ${i <= step ? "text-brand-700" : "text-slate-400"}`}>{label}</p>
              </li>
            ))}
          </ol>
        )}
        {order.trackingNumber && (
          <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">
            📦 <b>{t.order.tracking}:</b> {order.trackingCompany} <span dir="ltr">{order.trackingNumber}</span>
            {order.trackingUrl && <> · <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 underline">{t.order.trackParcel}</a></>}
          </p>
        )}
        {(order.returns ?? []).map((r) => (
          <p key={r.id} className="mt-3 rounded-lg bg-amber-50 p-3 text-sm">↩️ {t.order.statuses[r.status] ?? r.status}: {r.reason}{r.staffNote ? ` · ${r.staffNote}` : ""}</p>
        ))}
        {actions && (needsPayment || cancellable) && (
          <div className="mt-5 flex flex-wrap gap-3">
            {needsPayment && <form action={retryPayment}><input type="hidden" name="number" value={order.number} />{k && <input type="hidden" name="k" value={k} />}<button className="btn-primary">{t.order.completePayment}</button></form>}
            {cancellable && <form action={cancelOrder}><input type="hidden" name="number" value={order.number} />{k && <input type="hidden" name="k" value={k} />}<button className="btn-outline">{t.order.cancel}</button></form>}
          </div>
        )}
      </div>

      <div className="grid gap-5 md:grid-cols-[1fr_300px]">
        <div className="card divide-y">
          {order.items.map((i) => (
            <div key={i.id} className="flex gap-4 p-4">
              <div className="relative h-16 w-16 shrink-0 rounded-lg bg-slate-50"><Image src={i.image || "/img/gpu.svg"} alt="" fill className="object-contain p-1" unoptimized /></div>
              <div className="flex-1 text-sm">
                <p className="font-semibold">{i.name}</p>
                <p className="text-slate-500">{i.variantTitle.split(" / ").map((x) => t.values[x] ?? x).join(" / ")}{i.variantTitle ? " · " : ""}{t.order.qty} {i.quantity}{i.warranty ? ` · Care+ (${aed(i.warrantyPrice, locale)})` : ""}</p>
              </div>
              <p className="text-sm font-semibold">{aed((i.price + i.warrantyPrice) * i.quantity, locale)}</p>
            </div>
          ))}
        </div>
        <div className="space-y-5">
          <div className="card space-y-1.5 p-5 text-sm">
            <div className="flex justify-between"><span>{t.order.subtotal}</span><span>{aed(order.subtotal, locale)}</span></div>
            {order.discount > 0 && <div className="flex justify-between"><span>{t.order.discount} ({order.discountCode})</span><span>− {aed(order.discount, locale)}</span></div>}
            <div className="flex justify-between"><span>{t.order.delivery}</span><span>{order.shipping + order.codFee ? aed(order.shipping + order.codFee, locale) : t.cart.free}</span></div>
            {order.giftCardAmount > 0 && <div className="flex justify-between"><span>{t.order.giftCard}</span><span>− {aed(order.giftCardAmount, locale)}</span></div>}
            <div className="flex justify-between border-t pt-2 font-bold"><span>{t.order.total}</span><span>{aed(order.total, locale)}</span></div>
            {order.refundedAmount > 0 && <div className="flex justify-between text-red-600"><span>{t.order.statuses.REFUNDED}</span><span>− {aed(order.refundedAmount, locale)}</span></div>}
            <p className="text-xs text-slate-500">{fmt(t.order.inclVat, { amount: aed(order.vat, locale) })} · {t.order.methods[order.paymentMethod] ?? order.paymentMethod} · {order.shippingRateName}</p>
          </div>
          <div className="card p-5 text-sm">
            <p className="font-semibold">{t.order.address}</p>
            <p className="mt-1 text-slate-600">{order.fullName}<br />{order.building}, {order.street}<br />{order.area}, {locale === "ar" ? EMIRATES_AR[order.emirate] ?? order.emirate : order.emirate}<br /><span dir="ltr">{order.phone}</span></p>
          </div>
        </div>
      </div>
      {actions && canReturn && <ReturnForm number={order.number} k={k} items={order.items.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity }))} />}
    </div>
  );
}

import Image from "next/image";
import type { Order, OrderItem } from "@prisma/client";
import { aed, conditionLabel } from "@/lib/format";
import { warrantyPrice } from "@/lib/pricing";
import { cancelOrder, retryPayment } from "@/app/actions/checkout";

const STEPS = ["PROCESSING", "SHIPPED", "DELIVERED"];
export const statusColor: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800", PAID: "bg-emerald-100 text-emerald-800", PROCESSING: "bg-blue-100 text-blue-800",
  SHIPPED: "bg-indigo-100 text-indigo-800", DELIVERED: "bg-brand-100 text-brand-700", CANCELLED: "bg-slate-200 text-slate-700", REFUNDED: "bg-red-100 text-red-700",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusColor[status] ?? "bg-slate-100"}`}>{status}</span>;
}

export default function OrderView({ order, actions = true }: { order: Order & { items: OrderItem[] }; actions?: boolean }) {
  const stepIdx = order.status === "PAID" ? 0 : STEPS.indexOf(order.status);
  const needsPayment = order.paymentMethod === "CARD" && order.paymentStatus !== "PAID" && order.status !== "CANCELLED";
  const cancellable = ["PENDING", "PROCESSING"].includes(order.status) && order.paymentStatus !== "PAID";

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Order number</p>
            <p className="text-xl font-black">{order.number}</p>
            <p className="text-sm text-slate-500">Placed {order.createdAt.toLocaleString("en-AE", { dateStyle: "medium", timeStyle: "short" })}</p>
          </div>
          <div className="flex gap-2"><StatusBadge status={order.status} /><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">Payment: {order.paymentStatus}</span></div>
        </div>
        {order.status !== "CANCELLED" && order.status !== "REFUNDED" && (
          <ol className="mt-6 grid grid-cols-3 gap-2 text-center text-xs font-semibold">
            {["Confirmed", "Shipped", "Delivered"].map((s, i) => (
              <li key={s}>
                <div className={`h-2 rounded-full ${i <= stepIdx ? "bg-brand-600" : "bg-slate-200"}`} />
                <p className={`mt-2 ${i <= stepIdx ? "text-brand-700" : "text-slate-400"}`}>{s}</p>
              </li>
            ))}
          </ol>
        )}
        {actions && (needsPayment || cancellable) && (
          <div className="mt-5 flex flex-wrap gap-3">
            {needsPayment && (
              <form action={retryPayment}><input type="hidden" name="number" value={order.number} /><button className="btn-primary">Complete payment</button></form>
            )}
            {cancellable && (
              <form action={cancelOrder}><input type="hidden" name="number" value={order.number} /><button className="btn-outline">Cancel order</button></form>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-5 md:grid-cols-[1fr_300px]">
        <div className="card divide-y">
          {order.items.map((i) => (
            <div key={i.id} className="flex gap-4 p-4">
              <div className="relative h-16 w-16 shrink-0 rounded-lg bg-slate-50"><Image src={i.image} alt="" fill className="object-contain p-1" unoptimized /></div>
              <div className="flex-1 text-sm">
                <p className="font-semibold">{i.name}</p>
                <p className="text-slate-500">{conditionLabel(i.condition)} · Qty {i.quantity}{i.warranty ? ` · Care+ (${aed(warrantyPrice(i.price))})` : ""}</p>
              </div>
              <p className="text-sm font-semibold">{aed((i.price + (i.warranty ? warrantyPrice(i.price) : 0)) * i.quantity)}</p>
            </div>
          ))}
        </div>
        <div className="space-y-5">
          <div className="card space-y-1.5 p-5 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{aed(order.subtotal)}</span></div>
            {order.discount > 0 && <div className="flex justify-between"><span>Discount ({order.couponCode})</span><span>− {aed(order.discount)}</span></div>}
            <div className="flex justify-between"><span>Delivery & fees</span><span>{order.shipping ? aed(order.shipping) : "FREE"}</span></div>
            <div className="flex justify-between border-t pt-2 font-bold"><span>Total</span><span>{aed(order.total)}</span></div>
            <p className="text-xs text-slate-500">Incl. VAT {aed(order.vat)} · {order.paymentMethod === "COD" ? "Cash on delivery" : "Card"} · {order.shippingMethod === "EXPRESS" ? "Express" : "Standard"} delivery</p>
          </div>
          <div className="card p-5 text-sm">
            <p className="font-semibold">Delivery address</p>
            <p className="mt-1 text-slate-600">{order.fullName}<br />{order.building}, {order.street}<br />{order.area}, {order.emirate}<br />{order.phone}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

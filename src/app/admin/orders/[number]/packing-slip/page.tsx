import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { getOrder } from "@/lib/orders";
import { getSettings } from "@/lib/settings";
import { PrintButton } from "@/components/admin/client";

export const metadata = { title: "Packing slip" };

export default async function PackingSlip({ params }: { params: Promise<{ number: string }> }) {
  await requirePermission("orders");
  const { number } = await params;
  const [order, s] = await Promise.all([getOrder(number), getSettings()]);
  if (!order) notFound();
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex justify-end print:hidden"><PrintButton /></div>
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm print:border-0 print:p-0">
        <div className="flex justify-between">
          <div><p className="text-xl font-black">{s.storeName}</p><p className="text-slate-500">{s.address}</p></div>
          <div className="text-end"><p className="text-lg font-bold">Packing slip</p><p>Order <b>{order.number}</b></p><p>{order.createdAt.toLocaleDateString("en-AE", { dateStyle: "medium" })}</p></div>
        </div>
        <div className="mt-6 rounded-lg border border-slate-200 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Ship to</p>
          <p className="text-base">{order.fullName}<br />{order.building}, {order.street}<br />{order.area}, {order.emirate}<br />{order.phone}</p>
          <p className="mt-2 text-xs text-slate-500">Delivery: {order.shippingRateName}{order.paymentMethod === "COD" && order.paymentStatus === "PENDING" ? ` · COLLECT AED ${order.total} ON DELIVERY` : ""}</p>
        </div>
        <table className="mt-6 w-full">
          <thead><tr className="border-b-2 border-slate-900 text-xs uppercase text-slate-600"><th className="py-2 text-start">Item</th><th className="text-start">SKU</th><th className="text-end">Qty</th><th className="w-12 text-end">✓</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {order.items.map((i) => (
              <tr key={i.id}><td className="py-2">{i.name}{i.variantTitle && <span className="block text-xs text-slate-500">{i.variantTitle}</span>}{i.warranty && <span className="block text-xs">+ Care+ warranty card</span>}</td>
                <td className="font-mono text-xs">{i.sku ?? "—"}</td><td className="text-end text-base font-bold">{i.quantity}</td><td className="text-end">☐</td></tr>
            ))}
          </tbody>
        </table>
        {order.customerNote && <p className="mt-4 rounded bg-amber-50 p-3"><b>Customer note:</b> {order.customerNote}</p>}
        <p className="mt-10 text-center text-xs text-slate-500">Questions? {s.email} · {s.phone}</p>
      </div>
    </div>
  );
}

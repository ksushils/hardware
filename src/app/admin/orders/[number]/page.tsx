import { notFound } from "next/navigation";
import { getOrder } from "@/lib/orders";
import { ORDER_STATUSES } from "@/lib/format";
import { updateOrderStatus } from "@/app/actions/admin";
import OrderView from "@/components/OrderView";

export default async function AdminOrder({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const order = await getOrder(number);
  if (!order) notFound();
  return (
    <div className="space-y-5">
      <form action={updateOrderStatus} className="card flex flex-wrap items-center gap-3 p-4">
        <input type="hidden" name="number" value={order.number} />
        <span className="text-sm font-semibold">Update status:</span>
        <select name="status" defaultValue={order.status} className="input w-48 py-2">{ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <button className="btn-primary py-2">Update</button>
        <span className="text-sm text-slate-500">Customer: {order.email} · {order.phone}{order.notes ? ` · Notes: ${order.notes}` : ""}</span>
      </form>
      <OrderView order={order} actions={false} />
    </div>
  );
}

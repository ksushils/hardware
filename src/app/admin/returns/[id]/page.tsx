import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { aed } from "@/lib/format";
import { Card, Field, PageHeader, StatusBadge } from "@/components/admin/ui";
import { ConfirmButton, SubmitButton } from "@/components/admin/client";
import { Banner, type SP } from "@/components/admin/sales/queries";
import { refundReturn, updateReturnStatus } from "@/app/actions/admin/returns";

export const metadata = { title: "Return" };

export default async function ReturnDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  await requirePermission("orders");
  const { id } = await params;
  const sp = await searchParams;
  const ret = await db.returnRequest.findUnique({ where: { id }, include: { order: { include: { items: true } } } });
  if (!ret) notFound();
  let requested: { orderItemId: string; quantity: number }[] = [];
  try { requested = JSON.parse(ret.items); } catch { /* */ }
  const lines = requested.map((r) => ({ ...r, item: ret.order.items.find((i) => i.id === r.orderItemId) })).filter((l) => l.item);
  const suggested = Math.min(ret.order.total - ret.order.refundedAmount, lines.reduce((s, l) => s + (l.item!.price + l.item!.warrantyPrice) * l.quantity, 0));
  const hidden = <input type="hidden" name="id" value={ret.id} />;
  const statusForm = (status: string, label: string, primary = true, withNote = false) => (
    <form action={updateReturnStatus} className="space-y-2">
      {hidden}<input type="hidden" name="status" value={status} />
      {withNote && <textarea name="staffNote" rows={2} placeholder="Note to customer (optional)" className="in-a" />}
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="notify" defaultChecked className="accent-slate-900" /> Email customer</label>
      <SubmitButton className={primary ? "btn-a-primary" : "btn-a-danger"}>{label}</SubmitButton>
    </form>
  );

  return (
    <>
      <PageHeader back="/admin/returns" title={<span className="flex items-center gap-2">Return for {ret.order.number} <StatusBadge status={ret.status} /></span>}
        subtitle={`Requested ${ret.createdAt.toLocaleString("en-AE")}`} actions={<Link href={`/admin/orders/${ret.order.number}`} className="btn-a">View order</Link>} />
      <Banner sp={sp} />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card title="Items to return" pad={false}>
            <ul className="divide-y divide-slate-100">
              {lines.map((l) => (
                <li key={l.orderItemId} className="flex justify-between gap-3 p-4 text-sm">
                  <span>{l.item!.name}<span className="block text-xs text-slate-500">{l.item!.variantTitle}{l.item!.sku ? ` · ${l.item!.sku}` : ""}</span></span>
                  <span className="whitespace-nowrap">{l.quantity} × {aed(l.item!.price)}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Reason">
            <p className="font-medium">{ret.reason}</p>
            {ret.details && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{ret.details}</p>}
            {ret.staffNote && <p className="mt-3 rounded bg-slate-50 p-2 text-sm"><b>Staff note:</b> {ret.staffNote}</p>}
          </Card>
          {ret.status === "APPROVED" && (
            <Card title="Receive items">
              <form action={updateReturnStatus} className="space-y-3">
                {hidden}<input type="hidden" name="status" value="RECEIVED" />
                <p className="text-sm text-slate-600">Choose how many units to put back into stock after inspection.</p>
                {lines.map((l) => (
                  <label key={l.orderItemId} className="flex items-center justify-between gap-3 text-sm">
                    <span>{l.item!.name} <span className="text-slate-400">{l.item!.variantTitle}</span></span>
                    <input type="number" name={`restock_${l.orderItemId}`} min={0} max={l.quantity} defaultValue={l.quantity} className="in-a w-20 py-1 text-end" />
                  </label>
                ))}
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="notify" defaultChecked className="accent-slate-900" /> Email customer</label>
                <SubmitButton>Mark as received</SubmitButton>
              </form>
            </Card>
          )}
          {ret.status === "RECEIVED" && (
            <Card title="Refund">
              <form action={refundReturn} className="space-y-3">
                {hidden}
                <Field label="Refund amount (AED)" help={`Order paid: ${aed(ret.order.total)} · already refunded: ${aed(ret.order.refundedAmount)}`}>
                  <input type="number" name="amount" step="0.01" min={0} max={ret.order.total - ret.order.refundedAmount} defaultValue={Math.max(0, Math.round(suggested * 100) / 100)} className="in-a" />
                </Field>
                <ConfirmButton message="Issue refund and close this return?" className="btn-a-primary">Refund & close</ConfirmButton>
              </form>
            </Card>
          )}
        </div>
        <div className="space-y-4">
          <Card title="Customer">
            <p className="text-sm">{ret.order.fullName}<br /><a href={`mailto:${ret.order.email}`} className="text-sky-700">{ret.order.email}</a><br />{ret.order.phone}</p>
            <p className="mt-2 text-xs text-slate-500">{ret.order.building}, {ret.order.street}, {ret.order.area}, {ret.order.emirate}</p>
          </Card>
          {ret.status === "REQUESTED" && <>
            <Card title="Approve">{statusForm("APPROVED", "Approve return", true, true)}</Card>
            <Card title="Reject">{statusForm("REJECTED", "Reject return", false, true)}</Card>
          </>}
          {ret.status === "APPROVED" && <Card title="Reject">{statusForm("REJECTED", "Reject return", false, true)}</Card>}
          {ret.status === "REJECTED" && <Card title="Reopen">{statusForm("APPROVED", "Approve instead", true, true)}</Card>}
        </div>
      </div>
    </>
  );
}

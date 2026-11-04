import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getOrder } from "@/lib/orders";
import { aed, EMIRATES, csv } from "@/lib/format";
import { Badge, Card, Field, PageHeader, StatusBadge } from "@/components/admin/ui";
import { ConfirmButton, SubmitButton } from "@/components/admin/client";
import { Banner, type SP } from "@/components/admin/sales/queries";
import {
  addOrderComment, archiveOrder, cancelOrder, fulfillOrder, markDelivered, markPaid, refundOrder, resendConfirmation,
  updateOrderAddress, updateOrderNote, updateOrderTags, updateTracking,
} from "@/app/actions/admin/orders";

export const metadata = { title: "Order" };

export default async function OrderDetail({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<SP> }) {
  await requirePermission("orders");
  const { number } = await params;
  const sp = await searchParams;
  const order = await getOrder(number);
  if (!order) notFound();
  if (order.status === "DRAFT") {
    const { redirect } = await import("next/navigation");
    redirect(`/admin/draft-orders/${number}`);
  }
  const customer = order.userId ? await db.user.findUnique({ where: { id: order.userId } }) : await db.user.findUnique({ where: { email: order.email } });
  const orderCount = await db.order.count({ where: { email: order.email, status: { not: "DRAFT" } } });
  const refundable = Math.round((order.total - order.refundedAmount) * 100) / 100;
  const canRefund = ["PAID", "PARTIALLY_REFUNDED"].includes(order.paymentStatus) && refundable > 0;
  const hidden = <input type="hidden" name="number" value={order.number} />;
  const carePlus = order.items.reduce((s, i) => s + i.warrantyPrice * i.quantity, 0);
  const itemsSubtotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const sellerOrders = await db.sellerOrder.findMany({ where: { orderId: order.id }, include: { seller: { select: { shopName: true, id: true } }, items: true } });

  return (
    <>
      <PageHeader
        back="/admin/orders"
        title={<span className="flex flex-wrap items-center gap-2">{order.number}<StatusBadge status={order.paymentStatus} /><StatusBadge status={order.fulfillmentStatus} />{order.status !== "OPEN" && <StatusBadge status={order.status} />}</span>}
        subtitle={`${order.createdAt.toLocaleString("en-AE", { dateStyle: "long", timeStyle: "short" })} · ${order.source === "ADMIN" ? "Created by staff" : "Online store"}${order.locale === "ar" ? " · Arabic" : ""}`}
        actions={<>
          <Link href={`/admin/orders/${order.number}/invoice`} className="btn-a">Print invoice</Link>
          <Link href={`/admin/orders/${order.number}/packing-slip`} className="btn-a">Packing slip</Link>
          <form action={resendConfirmation}>{hidden}<SubmitButton className="btn-a" pendingText="Sending…">Resend confirmation</SubmitButton></form>
          {order.status === "OPEN" && <form action={archiveOrder}>{hidden}<input type="hidden" name="archive" value="1" /><SubmitButton className="btn-a">Archive</SubmitButton></form>}
          {order.status === "ARCHIVED" && <form action={archiveOrder}>{hidden}<input type="hidden" name="archive" value="0" /><SubmitButton className="btn-a">Unarchive</SubmitButton></form>}
        </>}
      />
      <Banner sp={sp} />
      {order.status === "CANCELLED" && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          Cancelled {order.cancelledAt?.toLocaleString("en-AE")}{order.cancelReason ? `: ${order.cancelReason}` : ""}.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {/* Line items + fulfillment */}
          <Card title={<span className="flex items-center gap-2"><StatusBadge status={order.fulfillmentStatus} /> {order.items.reduce((s, i) => s + i.quantity, 0)} item(s)</span>}
            actions={<span className="text-xs text-slate-500">{order.shippingRateName}{order.express ? " · Express" : ""}</span>} pad={false}>
            <ul className="divide-y divide-slate-100">
              {order.items.map((i) => (
                <li key={i.id} className="flex gap-3 p-4 text-sm">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border bg-slate-50"><Image src={i.image || "/img/gpu.svg"} alt="" fill className="object-contain p-1" unoptimized /></div>
                  <div className="min-w-0 flex-1">
                    {i.productId ? <Link href={`/admin/products/${i.productId}`} className="font-medium hover:underline">{i.name}</Link> : <span className="font-medium">{i.name}</span>}
                    {i.variantTitle && <div className="text-xs text-slate-500">{i.variantTitle}</div>}
                    {i.sku && <div className="text-xs text-slate-400">SKU: {i.sku}</div>}
                    {i.warranty && <Badge tone="blue">Care+ {aed(i.warrantyPrice)}/unit</Badge>}
                  </div>
                  <div className="whitespace-nowrap text-slate-600">{aed(i.price)} × {i.quantity}</div>
                  <div className="w-24 whitespace-nowrap text-end font-medium">{aed((i.price + i.warrantyPrice) * i.quantity)}</div>
                </li>
              ))}
            </ul>
            <div className="space-y-3 border-t border-slate-100 p-4">
              {order.trackingNumber && (
                <p className="text-sm">Tracking: <b>{order.trackingCompany}</b> {order.trackingUrl ? <a href={order.trackingUrl} target="_blank" className="text-sky-700 underline">{order.trackingNumber}</a> : order.trackingNumber}</p>
              )}
              {order.status === "OPEN" && order.fulfillmentStatus === "UNFULFILLED" && (
                <details className="rounded-lg border border-slate-200 p-3" open>
                  <summary className="cursor-pointer text-sm font-semibold">Fulfill items</summary>
                  <form action={fulfillOrder} className="mt-3 grid gap-3 sm:grid-cols-3">
                    {hidden}
                    <Field label="Shipping carrier"><input name="trackingCompany" list="carriers" className="in-a" placeholder="Aramex" /></Field>
                    <Field label="Tracking number"><input name="trackingNumber" className="in-a" /></Field>
                    <Field label="Tracking URL"><input name="trackingUrl" type="url" className="in-a" placeholder="https://" /></Field>
                    <datalist id="carriers">{["Aramex", "Emirates Post", "DHL", "FedEx", "SMSA", "Quiqup", "Fetchr", "Own delivery"].map((c) => <option key={c} value={c} />)}</datalist>
                    <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="notify" defaultChecked className="accent-slate-900" /> Send shipping confirmation to customer</label>
                    <div className="text-end"><SubmitButton pendingText="Fulfilling…">Fulfill items</SubmitButton></div>
                  </form>
                </details>
              )}
              {order.fulfillmentStatus === "FULFILLED" && (
                <div className="flex flex-wrap gap-2">
                  <form action={markDelivered}>{hidden}<SubmitButton>Mark as delivered</SubmitButton></form>
                  <details className="w-full rounded-lg border border-slate-200 p-3">
                    <summary className="cursor-pointer text-sm font-semibold">Edit tracking</summary>
                    <form action={updateTracking} className="mt-3 grid gap-3 sm:grid-cols-3">
                      {hidden}
                      <input name="trackingCompany" defaultValue={order.trackingCompany ?? ""} placeholder="Carrier" className="in-a" />
                      <input name="trackingNumber" defaultValue={order.trackingNumber ?? ""} placeholder="Tracking number" className="in-a" />
                      <input name="trackingUrl" defaultValue={order.trackingUrl ?? ""} placeholder="Tracking URL" className="in-a" />
                      <div className="sm:col-span-3"><SubmitButton className="btn-a">Save tracking</SubmitButton></div>
                    </form>
                  </details>
                </div>
              )}
            </div>
          </Card>

          {/* Payment */}
          <Card title={<span className="flex items-center gap-2"><StatusBadge status={order.paymentStatus} /> Payment</span>}
            actions={<span className="text-xs text-slate-500">{order.paymentMethod}{order.paymentRef ? ` · ${order.paymentRef}` : ""}</span>}>
            <dl className="space-y-1.5 text-sm">
              <Row l="Subtotal" sub={`${order.items.reduce((s, i) => s + i.quantity, 0)} item(s)`} r={aed(itemsSubtotal)} />
              {carePlus > 0 && <Row l="Care+ warranty" r={aed(carePlus)} />}
              {order.discount > 0 && <Row l="Discount" sub={order.discountCode ?? order.discountTitle ?? undefined} r={`− ${aed(order.discount)}`} />}
              <Row l="Shipping" sub={order.shippingRateName} r={order.shipping ? aed(order.shipping) : "Free"} />
              {order.codFee > 0 && <Row l="Cash on delivery fee" r={aed(order.codFee)} />}
              <Row l="VAT (included)" r={aed(order.vat)} muted />
              {order.giftCardAmount > 0 && <Row l="Gift card" sub={order.giftCardCode ?? undefined} r={`− ${aed(order.giftCardAmount)}`} />}
              <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold"><dt>Total</dt><dd>{aed(order.total)}</dd></div>
              {order.refundedAmount > 0 && <Row l="Refunded" r={`− ${aed(order.refundedAmount)}`} />}
              <div className="flex justify-between font-semibold"><dt>{order.paymentStatus === "PAID" || order.paymentStatus.includes("REFUNDED") ? "Net payment" : "Balance due"}</dt><dd>{aed(order.total - order.refundedAmount)}</dd></div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              {order.paymentStatus === "PENDING" && order.status !== "CANCELLED" && (
                <form action={markPaid} className="flex gap-2">{hidden}<input name="ref" placeholder="Reference (optional)" className="in-a w-44 py-1.5" /><SubmitButton>Mark as paid</SubmitButton></form>
              )}
            </div>
            {(
              <details className="mt-3 rounded-lg border border-slate-200 p-3" id="refund">
                <summary className="cursor-pointer text-sm font-semibold">Refund{canRefund ? ` (up to ${aed(refundable)})` : " / restock items"}</summary>
                <form action={refundOrder} className="mt-3 space-y-3">
                  {hidden}
                  <table className="w-full text-sm">
                    <thead><tr className="text-xs text-slate-500"><th className="text-start font-medium">Item</th><th className="text-end font-medium">Restock qty</th></tr></thead>
                    <tbody>{order.items.map((i) => (
                      <tr key={i.id}><td className="py-1">{i.name} <span className="text-slate-400">{i.variantTitle}</span></td>
                        <td className="py-1 text-end"><input type="number" name={`restock_${i.id}`} min={0} max={i.quantity} defaultValue={0} className="in-a w-20 py-1 text-end" /> <span className="text-xs text-slate-400">/ {i.quantity}</span></td></tr>
                    ))}</tbody>
                  </table>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Refund amount (AED)"><input type="number" step="0.01" min={0} max={refundable} name="amount" defaultValue={canRefund ? refundable : 0} className="in-a" /></Field>
                    <Field label="Reason (internal)"><input name="reason" className="in-a" placeholder="e.g. Returned, damaged in transit" /></Field>
                  </div>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="notify" defaultChecked className="accent-slate-900" /> Send refund notification to customer</label>
                  {!canRefund && <p className="text-xs text-slate-500">This order has no refundable payment. You can still restock items (leave the amount at 0).</p>}
                  <ConfirmButton message="Issue this refund?" className="btn-a-primary">Refund</ConfirmButton>
                </form>
              </details>
            )}
          </Card>

          {sellerOrders.length > 0 && (
            <Card title="Marketplace sellers">
              <div className="divide-y divide-slate-100 text-sm">
                {sellerOrders.map((so) => (
                  <div key={so.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div>
                      <a href={`/admin/sellers/${so.seller.id}`} className="font-semibold text-violet-700 hover:underline">🏪 {so.seller.shopName}</a>
                      <p className="text-xs text-slate-500">{so.items.map((i) => `${i.name} × ${i.quantity}`).join(", ")}{so.trackingNumber ? ` · ${so.trackingCompany ?? ""} ${so.trackingNumber}` : ""}</p>
                    </div>
                    <div className="text-end text-xs">
                      <StatusBadge status={so.status} />
                      <p className="mt-1">Subtotal AED {so.subtotal.toFixed(2)} · Commission <b>AED {so.commissionTotal.toFixed(2)}</b> · Seller AED {so.sellerEarning.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {/* Timeline */}
          <Card title="Timeline">
            <form action={addOrderComment} className="mb-4 flex gap-2">{hidden}<input name="message" placeholder="Leave a comment…" className="in-a" /><SubmitButton className="btn-a">Post</SubmitButton></form>
            <ol className="relative space-y-4 border-s border-slate-200 ps-5">
              {order.events.map((e) => (
                <li key={e.id} className="relative text-sm">
                  <span className={`absolute -start-[25px] top-1 h-2.5 w-2.5 rounded-full ${e.type === "note" ? "bg-sky-500" : e.type === "cancelled" ? "bg-red-500" : "bg-slate-400"}`} />
                  <p className="text-slate-800">{e.message}</p>
                  <p className="text-xs text-slate-400">{e.createdAt.toLocaleString("en-AE", { dateStyle: "medium", timeStyle: "short" })} · {e.type}</p>
                </li>
              ))}
              <li className="relative text-sm"><span className="absolute -start-[25px] top-1 h-2.5 w-2.5 rounded-full bg-emerald-500" /><p>Order placed.</p><p className="text-xs text-slate-400">{order.createdAt.toLocaleString("en-AE")}</p></li>
            </ol>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {order.customerNote && <Card title="Customer note"><p className="whitespace-pre-wrap text-sm">{order.customerNote}</p></Card>}
          <Card title="Customer">
            <div className="space-y-1 text-sm">
              {customer ? <Link href={`/admin/customers/${customer.id}`} className="font-medium text-sky-700 hover:underline">{customer.name}</Link> : <p className="font-medium">{order.fullName} <span className="text-xs text-slate-400">(guest)</span></p>}
              <p className="text-slate-500">{orderCount} order{orderCount === 1 ? "" : "s"}</p>
              <p className="pt-2 text-xs font-semibold uppercase text-slate-400">Contact</p>
              <a href={`mailto:${order.email}`} className="block text-sky-700">{order.email}</a>
              <a href={`tel:${order.phone}`} className="block">{order.phone}</a>
              <a href={`https://wa.me/${order.phone.replace(/\D/g, "").replace(/^0/, "971")}`} target="_blank" className="block text-emerald-700">WhatsApp ↗</a>
            </div>
          </Card>
          <Card title="Shipping address">
            <p className="text-sm leading-relaxed">{order.fullName}<br />{order.building}, {order.street}<br />{order.area}, {order.emirate}<br />United Arab Emirates<br />{order.phone}</p>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-sky-700">Edit address</summary>
              <form action={updateOrderAddress} className="mt-2 space-y-2">
                {hidden}
                <input name="fullName" defaultValue={order.fullName} className="in-a" placeholder="Full name" />
                <input name="phone" defaultValue={order.phone} className="in-a" placeholder="Phone" />
                <select name="emirate" defaultValue={order.emirate} className="in-a">{EMIRATES.map((e) => <option key={e}>{e}</option>)}</select>
                <input name="area" defaultValue={order.area} className="in-a" placeholder="Area" />
                <input name="street" defaultValue={order.street} className="in-a" placeholder="Street" />
                <input name="building" defaultValue={order.building} className="in-a" placeholder="Building / Apt" />
                <SubmitButton className="btn-a">Save address</SubmitButton>
              </form>
            </details>
          </Card>
          <Card title="Notes">
            <form action={updateOrderNote} className="space-y-2">{hidden}<textarea name="note" rows={3} defaultValue={order.note ?? ""} className="in-a" placeholder="Internal note (not visible to customer)" /><SubmitButton className="btn-a">Save note</SubmitButton></form>
          </Card>
          <Card title="Tags">
            <div className="mb-2 flex flex-wrap gap-1">{csv(order.tags).map((t) => <Badge key={t}>{t}</Badge>)}</div>
            <form action={updateOrderTags} className="flex gap-2">{hidden}<input name="tags" defaultValue={order.tags} className="in-a" placeholder="vip, gift, priority" /><SubmitButton className="btn-a">Save</SubmitButton></form>
          </Card>
          {order.returns.length > 0 && (
            <Card title="Returns">
              <ul className="space-y-1 text-sm">{order.returns.map((r) => <li key={r.id}><Link href={`/admin/returns/${r.id}`} className="text-sky-700 hover:underline">{r.reason}</Link> <StatusBadge status={r.status} /></li>)}</ul>
            </Card>
          )}
          {order.status !== "CANCELLED" && (
            <Card title="Cancel order">
              <form action={cancelOrder} className="space-y-2">
                {hidden}
                <select name="reason" className="in-a">{["Customer changed or cancelled order", "Fraudulent order", "Items unavailable", "Payment declined", "Other"].map((r) => <option key={r}>{r}</option>)}</select>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="restock" defaultChecked className="accent-slate-900" /> Restock items</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="notify" defaultChecked className="accent-slate-900" /> Notify customer</label>
                <ConfirmButton message="Cancel this order? This can't be undone.">Cancel order</ConfirmButton>
              </form>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Row({ l, r, sub, muted }: { l: string; r: string; sub?: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${muted ? "text-slate-500" : ""}`}>
      <dt>{l}{sub && <span className="ms-2 text-xs text-slate-400">{sub}</span>}</dt><dd className="whitespace-nowrap">{r}</dd>
    </div>
  );
}

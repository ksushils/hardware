import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { Card, PageHeader } from "@/components/admin/ui";
import { ConfirmButton, SubmitButton } from "@/components/admin/client";
import DraftForm from "@/components/admin/sales/DraftForm";
import { draftContext, emptyDraft } from "@/components/admin/sales/draftData";
import { Banner, type SP } from "@/components/admin/sales/queries";
import { completeDraft, deleteDraft, sendDraftInvoice } from "@/app/actions/admin/drafts";

export const metadata = { title: "Draft order" };

export default async function DraftDetail({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<SP> }) {
  await requirePermission("orders");
  const { number } = await params;
  const sp = await searchParams;
  const order = await db.order.findUnique({ where: { number }, include: { items: { include: { variant: true } }, events: { orderBy: { createdAt: "desc" } } } });
  if (!order) notFound();
  if (order.status !== "DRAFT") redirect(`/admin/orders/${number}`);
  const ctx = await draftContext();
  const rate = ctx.rates.find((r) => r.name === order.shippingRateName);
  const initial = {
    ...emptyDraft,
    number: order.number, email: order.email, fullName: order.fullName, phone: order.phone, emirate: order.emirate, area: order.area, street: order.street, building: order.building,
    lines: order.items.filter((i) => i.variantId).map((i) => ({
      variantId: i.variantId!, name: i.name, variantTitle: i.variantTitle, price: i.variant?.price ?? i.price, stock: i.variant?.stock ?? 0,
      tracked: !!i.variant && i.variant.trackInventory && !i.variant.continueSelling, image: i.image, sku: i.sku, quantity: i.quantity, warranty: i.warranty,
    })),
    discountType: (order.discount > 0 ? "amount" : "none") as "amount" | "none",
    discountValue: order.discount,
    discountReason: order.discountTitle?.replace(/^Custom discount:?\s*/, "") ?? "",
    shippingRateId: rate ? rate.id : order.shipping > 0 ? "custom" : "",
    customShipping: rate ? 0 : order.shipping,
    customShippingName: rate ? "" : order.shippingRateName,
    note: order.note ?? "", tags: order.tags,
  };
  const hidden = <input type="hidden" name="number" value={order.number} />;
  return (
    <>
      <PageHeader back="/admin/draft-orders" title={`Draft ${order.number}`} subtitle={`Created ${order.createdAt.toLocaleString("en-AE")}`}
        actions={<form action={deleteDraft}>{hidden}<ConfirmButton message="Delete this draft?">Delete draft</ConfirmButton></form>} />
      <Banner sp={sp} />
      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <Card title="Send invoice">
          <form action={sendDraftInvoice} className="space-y-2">
            {hidden}
            <p className="text-sm text-slate-600">Emails {order.email} a link to pay {order.total ? `AED ${order.total}` : ""} by card.</p>
            <textarea name="message" rows={2} placeholder="Custom message (optional)" className="in-a" />
            <SubmitButton pendingText="Sending…">Send invoice</SubmitButton>
          </form>
        </Card>
        <Card title="Complete order">
          <p className="mb-2 text-sm text-slate-600">Converts this draft into an order and deducts inventory. Save any changes first.</p>
          <div className="flex flex-wrap gap-2">
            <form action={completeDraft}>{hidden}<input type="hidden" name="paid" value="1" /><SubmitButton pendingText="Completing…">Mark as paid</SubmitButton></form>
            <form action={completeDraft}>{hidden}<input type="hidden" name="paid" value="0" /><SubmitButton className="btn-a" pendingText="Completing…">Payment pending (COD)</SubmitButton></form>
          </div>
        </Card>
      </div>
      <DraftForm initial={initial} rates={ctx.rates} cfg={ctx.cfg} />
      {order.events.length > 0 && (
        <Card title="History" className="mt-4">
          <ul className="space-y-1 text-sm">{order.events.map((e) => <li key={e.id}><span className="text-slate-400">{e.createdAt.toLocaleString("en-AE")}</span> · {e.message}</li>)}</ul>
        </Card>
      )}
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { aed, csv } from "@/lib/format";
import { Badge, Card, EmptyState, Field, PageHeader, Stat, StatusBadge, td, th } from "@/components/admin/ui";
import { ConfirmButton, SubmitButton } from "@/components/admin/client";
import { Banner, type SP } from "@/components/admin/sales/queries";
import { sendCustomerReset, toggleCustomerDisabled, updateCustomer, updateCustomerNotes } from "@/app/actions/admin/customers";

export const metadata = { title: "Customer" };

export default async function CustomerDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  await requirePermission("customers");
  const { id } = await params;
  const sp = await searchParams;
  const c = await db.user.findUnique({ where: { id }, include: { addresses: { orderBy: { isDefault: "desc" } }, reviews: { include: { product: { select: { name: true } } }, take: 5, orderBy: { createdAt: "desc" } } } });
  if (!c) notFound();
  const orders = await db.order.findMany({ where: { OR: [{ userId: c.id }, { email: c.email }], status: { not: "DRAFT" } }, orderBy: { createdAt: "desc" }, include: { items: { select: { quantity: true } } } });
  const counted = orders.filter((o) => o.status !== "CANCELLED");
  const spent = counted.reduce((s, o) => s + o.total - o.refundedAmount, 0);
  const hidden = <input type="hidden" name="id" value={c.id} />;

  return (
    <>
      <PageHeader back="/admin/customers" title={<span className="flex items-center gap-2">{c.name}{c.disabled && <Badge tone="red">Disabled</Badge>}{c.role !== "CUSTOMER" && <Badge tone="purple">{c.role}</Badge>}</span>}
        subtitle={`Customer since ${c.createdAt.toLocaleDateString("en-AE", { dateStyle: "long" })}`}
        actions={<Link href={`/admin/draft-orders/new?customer=${c.id}`} className="btn-a-primary">Create order</Link>} />
      <Banner sp={sp} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Amount spent" value={aed(spent)} />
        <Stat label="Orders" value={counted.length} />
        <Stat label="Average order value" value={aed(counted.length ? spent / counted.length : 0)} />
        <Stat label="Last order" value={counted[0] ? counted[0].createdAt.toLocaleDateString("en-AE", { dateStyle: "medium" }) : "—"} sub={counted.length ? `First: ${counted[counted.length - 1].createdAt.toLocaleDateString("en-AE")}` : undefined} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card title="Orders" pad={false}>
            {orders.length === 0 ? <EmptyState title="No orders yet" /> : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50"><tr><th className={th}>Order</th><th className={th}>Date</th><th className={th}>Payment</th><th className={th}>Fulfillment</th><th className={th}>Items</th><th className={th}>Total</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td className={td}><Link href={`/admin/orders/${o.number}`} className="font-medium hover:underline">{o.number}</Link>{o.status !== "OPEN" && <span className="ms-1"><StatusBadge status={o.status} /></span>}</td>
                      <td className={td}>{o.createdAt.toLocaleDateString("en-AE")}</td>
                      <td className={td}><StatusBadge status={o.paymentStatus} /></td>
                      <td className={td}><StatusBadge status={o.fulfillmentStatus} /></td>
                      <td className={td}>{o.items.reduce((s, i) => s + i.quantity, 0)}</td>
                      <td className={td}>{aed(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          {c.reviews.length > 0 && (
            <Card title="Recent reviews">
              <ul className="space-y-2 text-sm">{c.reviews.map((r) => <li key={r.id}><b>{"★".repeat(r.rating)}</b> {r.product.name}: <span className="text-slate-600">{r.comment}</span></li>)}</ul>
            </Card>
          )}
          <Card title="Customer details">
            <form action={updateCustomer} className="grid gap-3 sm:grid-cols-2">
              {hidden}
              <Field label="Full name"><input name="name" defaultValue={c.name} className="in-a" /></Field>
              <Field label="Phone"><input name="phone" defaultValue={c.phone ?? ""} className="in-a" /></Field>
              <Field label="Language"><select name="locale" defaultValue={c.locale} className="in-a"><option value="en">English</option><option value="ar">Arabic</option></select></Field>
              <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="acceptsMarketing" defaultChecked={c.acceptsMarketing} className="accent-slate-900" /> Subscribed to email marketing</label>
              <div className="sm:col-span-2"><SubmitButton className="btn-a">Save details</SubmitButton></div>
            </form>
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Contact">
            <p className="text-sm"><a href={`mailto:${c.email}`} className="text-sky-700">{c.email}</a><br />{c.phone ?? "No phone"}</p>
            <p className="mt-2 text-xs">{c.acceptsMarketing ? <Badge tone="green">Email subscribed</Badge> : <Badge>Not subscribed</Badge>}</p>
          </Card>
          <Card title="Addresses">
            {c.addresses.length === 0 ? <p className="text-sm text-slate-500">No saved addresses.</p> : (
              <ul className="space-y-3 text-sm">{c.addresses.map((a) => (
                <li key={a.id}>{a.isDefault && <Badge tone="blue">Default</Badge>}<p>{a.fullName}<br />{a.building}, {a.street}<br />{a.area}, {a.emirate}<br />{a.phone}</p></li>
              ))}</ul>
            )}
          </Card>
          <Card title="Notes & tags">
            <form action={updateCustomerNotes} className="space-y-2">
              {hidden}
              <textarea name="note" rows={3} defaultValue={c.note ?? ""} placeholder="Add a note" className="in-a" />
              <div className="flex flex-wrap gap-1">{csv(c.tags).map((t) => <Badge key={t}>{t}</Badge>)}</div>
              <input name="tags" defaultValue={c.tags} placeholder="Tags, comma separated" className="in-a" />
              <SubmitButton className="btn-a">Save</SubmitButton>
            </form>
          </Card>
          <Card title="Account">
            <div className="space-y-2">
              <form action={sendCustomerReset}>{hidden}<SubmitButton className="btn-a w-full" pendingText="Sending…">Send password reset email</SubmitButton></form>
              {c.role === "CUSTOMER" && (
                <form action={toggleCustomerDisabled}>{hidden}
                  {c.disabled ? <SubmitButton className="btn-a w-full">Enable account</SubmitButton> : <ConfirmButton message="Disable this account? The customer won't be able to sign in." className="btn-a-danger w-full">Disable account</ConfirmButton>}
                </form>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

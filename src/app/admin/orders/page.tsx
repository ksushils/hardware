import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { aed, EMIRATES, FULFILLMENT_STATUSES, PAYMENT_STATUSES, csv } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader, Pagination, StatusBadge, Tabs, td, th } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/client";
import { SelectAll } from "@/components/admin/sales/client";
import { Banner, ORDER_TABS, one, orderWhere, qs, type SP } from "@/components/admin/sales/queries";
import { bulkOrders } from "@/app/actions/admin/orders";

export const metadata = { title: "Orders" };
const PAGE = 25;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePermission("orders");
  const sp = await searchParams;
  const tab = one(sp.tab) || "all";
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const where = orderWhere(sp);
  const [orders, total] = await Promise.all([
    db.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { _count: { select: { items: true } }, items: { select: { quantity: true } } } }),
    db.order.count({ where }),
  ]);
  const ret = `/admin/orders${qs(sp, { msg: undefined, error: undefined })}`;
  const filtered = ["q", "payment", "fulfillment", "method", "emirate", "from", "to", "tag"].some((k) => one(sp[k]));

  return (
    <>
      <PageHeader
        title="Orders"
        actions={<>
          <a href={`/api/admin/export/orders${qs(sp, { page: undefined, msg: undefined, error: undefined })}`} className="btn-a">Export CSV</a>
          <Link href="/admin/draft-orders/new" className="btn-a-primary">Create order</Link>
        </>}
      />
      <Banner sp={sp} />
      <Card pad={false}>
        <Tabs current={tab} tabs={ORDER_TABS.map((t) => ({ ...t, href: `/admin/orders${qs({}, { tab: t.key === "all" ? undefined : t.key })}` }))} />
        <form className="grid gap-2 border-b border-slate-100 p-3 md:grid-cols-[1fr_repeat(4,auto)]">
          {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
          <input name="q" defaultValue={one(sp.q)} placeholder="Search by order #, email, name or phone" className="in-a" />
          <select name="payment" defaultValue={one(sp.payment)} className="in-a"><option value="">Payment status</option>{PAYMENT_STATUSES.map((x) => <option key={x} value={x}>{x.replace(/_/g, " ").toLowerCase()}</option>)}</select>
          <select name="fulfillment" defaultValue={one(sp.fulfillment)} className="in-a"><option value="">Fulfillment</option>{FULFILLMENT_STATUSES.map((x) => <option key={x} value={x}>{x.toLowerCase()}</option>)}</select>
          <select name="method" defaultValue={one(sp.method)} className="in-a"><option value="">Payment method</option>{["CARD", "COD", "MANUAL", "GIFT_CARD"].map((x) => <option key={x}>{x}</option>)}</select>
          <select name="emirate" defaultValue={one(sp.emirate)} className="in-a"><option value="">Emirate</option>{EMIRATES.map((x) => <option key={x}>{x}</option>)}</select>
          <div className="flex flex-wrap items-center gap-2 md:col-span-5">
            <label className="text-xs text-slate-500">From <input type="date" name="from" defaultValue={one(sp.from)} className="in-a w-auto py-1.5" /></label>
            <label className="text-xs text-slate-500">To <input type="date" name="to" defaultValue={one(sp.to)} className="in-a w-auto py-1.5" /></label>
            <input name="tag" defaultValue={one(sp.tag)} placeholder="Tag" className="in-a w-32 py-1.5" />
            <button className="btn-a-primary">Filter</button>
            {filtered && <Link href={`/admin/orders${qs({}, { tab: tab === "all" ? undefined : tab })}`} className="btn-a">Clear</Link>}
          </div>
        </form>

        <form id="bulk" action={bulkOrders} className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 text-sm">
          <input type="hidden" name="return" value={ret} />
          <span className="text-slate-500">Bulk actions:</span>
          <select name="action" className="in-a w-auto py-1.5">
            <option value="fulfill">Mark as fulfilled</option>
            <option value="archive">Archive</option>
            <option value="unarchive">Unarchive</option>
            <option value="tag">Add tag</option>
            <option value="untag">Remove tag</option>
          </select>
          <input name="tag" placeholder="Tag (for tag actions)" className="in-a w-44 py-1.5" />
          <SubmitButton className="btn-a" pendingText="Applying…">Apply to selected</SubmitButton>
        </form>

        {orders.length === 0 ? (
          <EmptyState title="No orders found" description={filtered ? "Try changing the filters." : "Orders will appear here when customers check out."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50"><tr>
                <th className={`${th} w-8`}><SelectAll formId="bulk" /></th>
                <th className={th}>Order</th><th className={th}>Date</th><th className={th}>Customer</th><th className={th}>Total</th>
                <th className={th}>Payment</th><th className={th}>Fulfillment</th><th className={th}>Items</th><th className={th}>Delivery</th><th className={th}>Tags</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className={td}><input type="checkbox" name="ids" value={o.id} form="bulk" className="accent-slate-900" /></td>
                    <td className={td}>
                      <Link href={`/admin/orders/${o.number}`} className="font-semibold text-slate-900 hover:underline">{o.number}</Link>
                      {o.status !== "OPEN" && <span className="ms-1.5"><StatusBadge status={o.status} /></span>}
                    </td>
                    <td className={`${td} whitespace-nowrap text-slate-600`}>{o.createdAt.toLocaleString("en-AE", { dateStyle: "medium", timeStyle: "short" })}</td>
                    <td className={td}>{o.fullName}<div className="text-xs text-slate-500">{o.email}</div></td>
                    <td className={`${td} whitespace-nowrap font-medium`}>{aed(o.total)}</td>
                    <td className={td}><StatusBadge status={o.paymentStatus} /><div className="mt-0.5 text-[11px] text-slate-400">{o.paymentMethod}</div></td>
                    <td className={td}><StatusBadge status={o.fulfillmentStatus} /></td>
                    <td className={td}>{o.items.reduce((s, i) => s + i.quantity, 0)}</td>
                    <td className={`${td} text-xs`}>{o.shippingRateName}{o.express && <Badge tone="purple">Express</Badge>}</td>
                    <td className={td}><div className="flex flex-wrap gap-1">{csv(o.tags).map((t) => <Badge key={t}>{t}</Badge>)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageSize={PAGE} total={total} makeHref={(p) => `/admin/orders${qs(sp, { page: p, msg: undefined, error: undefined })}`} />
      </Card>
    </>
  );
}

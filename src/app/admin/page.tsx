import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { hasPermission, PERMISSIONS, type Permission } from "@/lib/permissions";
import { aed } from "@/lib/format";
import { BarChart, Card, Stat, StatusBadge } from "@/components/admin/ui";
import RangePicker from "@/components/admin/store/RangePicker";
import { getAnalytics, parseRange } from "@/components/admin/store/analyticsData";

export const metadata = { title: "Home" };

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ range?: string; denied?: string }> }) {
  const user = await requireStaff();
  const sp = await searchParams;
  const range = parseRange({ range: sp.range }, "7");
  const can = (p: Permission) => hasPermission(user, p);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const dayAgo = new Date(Date.now() - 86400000);

  const [analytics, newCustomers, todo, recent, activity, lowStock] = await Promise.all([
    can("analytics") || can("orders") ? getAnalytics(range) : null,
    can("customers") ? db.user.count({ where: { role: "CUSTOMER", createdAt: { gte: range.from, lte: range.to } } }) : null,
    Promise.all([
      can("orders") ? db.order.count({ where: { status: "OPEN", fulfillmentStatus: "UNFULFILLED", OR: [{ paymentStatus: "PAID" }, { paymentMethod: "COD", paymentStatus: "PENDING" }] } }) : 0,
      can("orders") ? db.order.count({ where: { status: "OPEN", paymentMethod: "CARD", paymentStatus: { in: ["PENDING", "FAILED"] } } }) : 0,
      can("orders") ? db.returnRequest.count({ where: { status: "REQUESTED" } }) : 0,
      can("products") ? db.review.count({ where: { status: "PENDING" } }) : 0,
      can("products") ? db.variant.count({ where: { trackInventory: true, stock: { lte: 2 }, product: { status: "ACTIVE" } } }) : 0,
      can("orders") ? db.checkout.count({ where: { recoveredOrder: null, email: { not: null }, updatedAt: { gte: dayAgo } } }) : 0,
      can("orders") ? db.supportCase.count({ where: { status: { in: ["OPEN", "IN_REVIEW", "ESCALATED"] } } }) : 0,
    ]),
    can("orders") ? db.order.findMany({ where: { status: { not: "DRAFT" } }, orderBy: { createdAt: "desc" }, take: 6 }) : [],
    db.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    can("products") ? db.variant.findMany({ where: { trackInventory: true, stock: { lte: 2 }, product: { status: "ACTIVE" } }, include: { product: { select: { id: true, name: true } } }, orderBy: { stock: "asc" }, take: 6 }) : [],
  ]);
  const [toFulfil, unpaid, returns, reviews, low, abandoned, supportCases] = todo;
  const todos = [
    { n: toFulfil, label: "orders to fulfil", href: "/admin/orders?tab=unfulfilled", perm: "orders" },
    { n: unpaid, label: "unpaid card orders", href: "/admin/orders?tab=unpaid", perm: "orders" },
    { n: returns, label: "return requests", href: "/admin/returns", perm: "orders" },
    { n: supportCases, label: "support cases need attention", href: "/admin/cases", perm: "orders" },
    { n: abandoned, label: "abandoned checkouts in the last 24h", href: "/admin/abandoned", perm: "orders" },
    { n: reviews, label: "reviews awaiting moderation", href: "/admin/reviews?status=PENDING", perm: "products" },
    { n: low, label: "variants low on stock", href: "/admin/inventory?filter=low", perm: "products" },
  ].filter((t) => can(t.perm as Permission) && t.n > 0);
  const k = analytics?.kpi;
  const denied = sp.denied && sp.denied in PERMISSIONS ? PERMISSIONS[sp.denied as Permission] : null;

  return (
    <div className="space-y-5">
      {denied && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">You don&apos;t have permission for <b>{denied}</b>. Ask the store owner to grant access.</div>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{greet}, {user.name.split(" ")[0]} 👋</h1>
          <p className="text-sm text-slate-500">Here&apos;s what&apos;s happening with your store.</p>
        </div>
        {k && <RangePicker base="/admin" range={range} options={["today", "7", "30"]} custom={false} />}
      </div>

      {k && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Total sales" value={aed(k.total)} sub={range.label} />
          <Stat label="Orders" value={k.orders} sub={`${k.units} units`} />
          <Stat label="Average order value" value={aed(k.aov)} />
          {newCustomers != null ? <Stat label="New customers" value={newCustomers} sub={`${k.returningRate}% returning`} /> : <Stat label="Refunds" value={aed(k.refunds)} />}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {analytics && (
            <Card title="Sales over time" actions={can("analytics") && <Link href="/admin/analytics" className="text-xs font-medium text-slate-500 hover:text-slate-900">View report →</Link>}>
              <BarChart data={analytics.salesSeries} format={(n) => aed(n)} />
            </Card>
          )}
          {can("orders") && (
            <Card title="Recent orders" pad={false} actions={<Link href="/admin/orders" className="text-xs font-medium text-slate-500 hover:text-slate-900">All orders →</Link>}>
              {recent.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">No orders yet.</p> : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {recent.map((o) => (
                    <li key={o.id}>
                      <Link href={`/admin/orders/${o.number}`} className="flex flex-wrap items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                        <span className="w-32 font-semibold">{o.number}</span>
                        <span className="min-w-0 flex-1 truncate text-slate-600">{o.fullName}</span>
                        <StatusBadge status={o.paymentStatus} /><StatusBadge status={o.fulfillmentStatus} />
                        <span className="w-24 text-end tabular-nums">{aed(o.total)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
          {analytics && analytics.tables.products.length > 0 && (
            <Card title="Top products" pad={false}>
              <ul className="divide-y divide-slate-100 text-sm">
                {analytics.tables.products.slice(0, 5).map((p, i) => (
                  <li key={p.label} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-100 text-xs font-bold">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{p.label}</span>
                    <span className="text-slate-500">{p.units} sold</span>
                    <span className="w-24 text-end font-medium tabular-nums">{aed(p.sales)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card title="Things to do">
            {todos.length === 0 ? <p className="text-sm text-slate-500">🎉 All caught up. Nothing needs your attention.</p> : (
              <ul className="space-y-2 text-sm">
                {todos.map((t) => (
                  <li key={t.href}>
                    <Link href={t.href} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
                      <span><b>{t.n}</b> {t.label}</span><span className="text-slate-400">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {lowStock.length > 0 && (
            <Card title="Low stock" actions={<Link href="/admin/inventory" className="text-xs font-medium text-slate-500 hover:text-slate-900">Inventory →</Link>}>
              <ul className="space-y-2 text-sm">
                {lowStock.map((v) => (
                  <li key={v.id} className="flex justify-between gap-2">
                    <Link href={`/admin/products/${v.product.id}`} className="min-w-0 truncate hover:underline">{v.product.name} <span className="text-slate-500">· {v.title}</span></Link>
                    <span className={`shrink-0 font-semibold ${v.stock <= 0 ? "text-red-600" : "text-amber-600"}`}>{v.stock}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card title="Recent activity">
            {activity.length === 0 ? <p className="text-sm text-slate-500">No activity yet.</p> : (
              <ul className="space-y-3 text-sm">
                {activity.map((a) => (
                  <li key={a.id} className="border-s-2 border-slate-200 ps-3">
                    <p className="text-slate-800">{a.message}</p>
                    <p className="text-xs text-slate-500">{a.userName ?? "System"} · {a.createdAt.toLocaleString("en-AE", { dateStyle: "medium", timeStyle: "short" })}</p>
                  </li>
                ))}
              </ul>
            )}
            {can("settings") && <Link href="/admin/settings/activity" className="mt-3 block text-xs font-medium text-slate-500 hover:text-slate-900">View all activity →</Link>}
          </Card>
        </div>
      </div>
    </div>
  );
}

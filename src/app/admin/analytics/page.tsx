import { requirePermission } from "@/lib/auth";
import { aed } from "@/lib/format";
import { BarChart, Card, PageHeader, Stat, th, td } from "@/components/admin/ui";
import RangePicker from "@/components/admin/store/RangePicker";
import { getAnalytics, parseRange, TABLES, type TableKey } from "@/components/admin/store/analyticsData";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  await requirePermission("analytics");
  const sp = await searchParams;
  const range = parseRange(sp);
  const data = await getAnalytics(range);
  const k = data.kpi;
  const q = new URLSearchParams({ range: range.key, ...(sp.from ? { from: sp.from } : {}), ...(sp.to ? { to: sp.to } : {}) }).toString();
  const exportHref = (table: string) => `/api/admin/analytics/export?table=${table}&${q}`;

  return (
    <div className="space-y-5">
      <PageHeader title="Analytics" subtitle={`${range.label} · paid & cash-on-delivery orders, excluding drafts and cancellations`}
        actions={<a href={exportHref("summary")} className="btn-a">Export summary</a>} />
      <RangePicker base="/admin/analytics" range={range} options={["7", "30", "90", "365"]} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total sales" value={aed(k.total)} sub="Net sales + shipping" />
        <Stat label="Orders" value={k.orders} sub={`${k.units} units sold`} />
        <Stat label="Average order value" value={aed(k.aov)} />
        <Stat label="Returning customer rate" value={`${k.returningRate}%`} sub={`${k.returning} of ${k.customers} customers`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Sales over time" actions={<a href={exportHref("timeseries")} className="text-xs font-medium text-slate-500 hover:text-slate-900">CSV</a>}>
          <BarChart data={data.salesSeries} format={(n) => aed(n)} />
        </Card>
        <Card title="Orders over time"><BarChart data={data.orderSeries} /></Card>
      </div>

      <Card title="Sales breakdown" pad={false}>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            {[
              ["Gross sales", k.gross], ["Discounts", -k.discounts], ["Returns / refunds", -k.refunds], ["Net sales", k.net, true],
              ["Shipping & COD fees", k.shipping], ["Total sales", k.total, true], ["of which VAT (5%)", k.vat], ["Paid with gift cards", k.giftCards],
              ["Gross profit (items with cost)", k.grossProfit, true], ["Gross margin", `${k.margin}%`],
            ].map(([l, v, bold]) => (
              <tr key={String(l)} className={bold ? "font-semibold" : ""}>
                <td className={td}>{l}</td>
                <td className={`${td} text-end tabular-nums`}>{typeof v === "number" ? aed(v) : v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {(Object.keys(TABLES) as TableKey[]).map((key) => {
          const rows = data.tables[key].slice(0, 10);
          return (
            <Card key={key} title={TABLES[key].title} pad={false} actions={<a href={exportHref(key)} className="text-xs font-medium text-slate-500 hover:text-slate-900">Export CSV</a>}>
              {rows.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">No data for this period.</p> : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50"><tr>
                    <th className={th}>{TABLES[key].label}</th><th className={`${th} text-end`}>Orders</th>
                    <th className={`${th} text-end`}>{key === "discounts" ? "Discount" : "Units"}</th><th className={`${th} text-end`}>Sales</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r) => (
                      <tr key={r.label}>
                        <td className={`${td} max-w-[14rem] truncate`} title={r.label}>{key === "customers" ? <><span className="font-medium">{r.extra}</span><br /><span className="text-xs text-slate-500">{r.label}</span></> : r.label}</td>
                        <td className={`${td} text-end tabular-nums`}>{r.orders}</td>
                        <td className={`${td} text-end tabular-nums`}>{key === "discounts" ? aed(Number(r.extra)) : r.units}</td>
                        <td className={`${td} text-end tabular-nums`}>{aed(r.sales)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

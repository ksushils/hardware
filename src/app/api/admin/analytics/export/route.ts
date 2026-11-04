import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getAnalytics, parseRange, TABLES, type TableKey } from "@/components/admin/store/analyticsData";

const esc = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** GET /api/admin/analytics/export?table=products|...|summary|timeseries&range=30 */
export async function GET(req: Request) {
  const user = await getUser();
  if (!hasPermission(user, "analytics")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const sp = Object.fromEntries(url.searchParams) as Record<string, string>;
  const range = parseRange(sp);
  const data = await getAnalytics(range);
  const table = sp.table ?? "summary";
  let rows: unknown[][];
  if (table === "summary") {
    rows = [["Metric", "Value"], ...Object.entries(data.kpi)];
  } else if (table === "timeseries") {
    rows = [["Period", "Net sales (AED)", "Orders"], ...data.salesSeries.map((s, i) => [s.label, s.value, data.orderSeries[i]?.value ?? 0])];
  } else if (table in TABLES) {
    const t = TABLES[table as TableKey];
    const list = data.tables[table as TableKey];
    rows = table === "customers"
      ? [["Email", "Name", "Orders", "Units", "Sales (AED)"], ...list.map((r) => [r.label, r.extra, r.orders, r.units, r.sales])]
      : table === "discounts"
        ? [["Code", "Orders", "Discount given (AED)", "Sales (AED)"], ...list.map((r) => [r.label, r.orders, r.extra, r.sales])]
        : [[t.label, "Orders", "Units", "Sales (AED)"], ...list.map((r) => [r.label, r.orders, r.units, r.sales])];
  } else {
    return NextResponse.json({ error: "Unknown table" }, { status: 400 });
  }
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const name = `${table}-${range.from.toISOString().slice(0, 10)}-to-${range.to.toISOString().slice(0, 10)}.csv`;
  return new NextResponse("﻿" + csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"` } });
}

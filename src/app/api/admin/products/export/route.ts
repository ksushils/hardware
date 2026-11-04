import type { Prisma } from "@prisma/client";
import { loadExportProducts, productsToRows, rowsToCsv, rowsToXlsx } from "@/lib/productImport";
import { logActivity } from "@/lib/activity";
import { forbidden, productsGuard } from "../guard";

export async function GET(req: Request) {
  const user = await productsGuard();
  if (!user) return forbidden();
  const sp = new URL(req.url).searchParams;
  const where: Prisma.ProductWhereInput = {};
  const status = sp.get("status");
  if (status && ["ACTIVE", "DRAFT", "ARCHIVED"].includes(status)) where.status = status;
  const ids = sp.get("ids");
  if (ids) where.id = { in: ids.split(",") };
  const q = sp.get("q");
  if (q) where.OR = [{ name: { contains: q } }, { brand: { contains: q } }, { tags: { contains: q } }, { variants: { some: { sku: { contains: q } } } }];
  const rows = productsToRows(await loadExportProducts(where));
  await logActivity(user, "exported", "product", `Exported ${rows.length} product rows`);
  const stamp = new Date().toISOString().slice(0, 10);
  if (sp.get("format") === "csv")
    return new Response(rowsToCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="products-${stamp}.csv"` } });
  const buf = await rowsToXlsx(rows);
  return new Response(new Uint8Array(buf), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="products-${stamp}.xlsx"` },
  });
}

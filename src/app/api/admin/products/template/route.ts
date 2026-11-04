import { TEMPLATE_ROWS, rowsToCsv, rowsToXlsx } from "@/lib/productImport";
import { forbidden, productsGuard } from "../guard";

export async function GET(req: Request) {
  if (!(await productsGuard())) return forbidden();
  const format = new URL(req.url).searchParams.get("format") === "csv" ? "csv" : "xlsx";
  if (format === "csv")
    return new Response(rowsToCsv(TEMPLATE_ROWS), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="product-import-template.csv"' } });
  const buf = await rowsToXlsx(TEMPLATE_ROWS, true);
  return new Response(new Uint8Array(buf), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="product-import-template.xlsx"' },
  });
}

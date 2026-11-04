import { getSellerForUser } from "@/lib/sellerAuth";
import { catalogueCsv, offersExportCsv, offersExportXlsx, templateCsv, templateXlsx } from "@/lib/sellerImport";

export const dynamic = "force-dynamic";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Template / catalogue / "my offers" downloads for approved sellers only. ?format=xlsx|csv|catalogue|offers-xlsx|offers-csv */
export async function GET(req: Request) {
  const { seller } = await getSellerForUser();
  if (!seller || seller.status !== "APPROVED") return new Response("Forbidden", { status: 403 });
  const format = new URL(req.url).searchParams.get("format") ?? "xlsx";
  const headers = (name: string, type: string) => ({ "Content-Type": type, "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
  if (format === "xlsx") return new Response(new Uint8Array(await templateXlsx()), { headers: headers("offers-template.xlsx", XLSX) });
  if (format === "csv") return new Response(await templateCsv(), { headers: headers("offers-template.csv", "text/csv; charset=utf-8") });
  if (format === "catalogue") return new Response(await catalogueCsv(), { headers: headers("catalogue.csv", "text/csv; charset=utf-8") });
  if (format === "offers-xlsx") return new Response(new Uint8Array(await offersExportXlsx(seller)), { headers: headers("my-offers.xlsx", XLSX) });
  if (format === "offers-csv") return new Response(await offersExportCsv(seller), { headers: headers("my-offers.csv", "text/csv; charset=utf-8") });
  return new Response("Unknown format", { status: 400 });
}

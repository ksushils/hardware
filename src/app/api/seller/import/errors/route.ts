import { getSellerForUser } from "@/lib/sellerAuth";
import { errorsCsv, loadDraft } from "@/lib/sellerImport";

export const dynamic = "force-dynamic";

/** Row-level error report (CSV, formula-injection-safe) for the seller's own upload. */
export async function GET(req: Request) {
  const { seller } = await getSellerForUser();
  if (!seller || seller.status !== "APPROVED") return new Response("Forbidden", { status: 403 });
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const draft = await loadDraft(seller.id, token);
  if (!draft) return new Response("Not found", { status: 404 });
  return new Response(errorsCsv(draft.lastErrors ?? []), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="import-errors.csv"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}

import { getSellerForUser } from "@/lib/sellerAuth";
import { csvResponse, sellerStatement, statementCsv } from "@/lib/ledgerReports";

export const dynamic = "force-dynamic";

// A seller can only ever download their own statement: the seller id comes from the session, never from the URL.
export async function GET(_: Request, { params }: { params: Promise<{ ym: string }> }) {
  const { seller } = await getSellerForUser();
  if (!seller || seller.status !== "APPROVED") return new Response("Forbidden", { status: 403 });
  const { ym } = await params;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)) return new Response("Bad month", { status: 400 });
  const st = await sellerStatement(seller.id, ym);
  if (!st) return new Response("Not found", { status: 404 });
  return csvResponse(`statement-${st.seller.slug}-${ym}.csv`, statementCsv(st));
}

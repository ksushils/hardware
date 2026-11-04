import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSellerForUser } from "@/lib/sellerAuth";

export async function GET() {
  const { seller } = await getSellerForUser();
  if (!seller || seller.status !== "APPROVED") return new NextResponse("Forbidden", { status: 403 });
  const txns = await db.sellerTransaction.findMany({ where: { sellerId: seller.id }, orderBy: { createdAt: "asc" } });
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  let running = 0;
  const lines = ["date,type,note,amount,available_from,running_total", ...txns.map((t) => { running += t.amount; return [t.createdAt.toISOString(), t.type, t.note, t.amount.toFixed(2), t.availableAt.toISOString(), running.toFixed(2)].map(q).join(","); })];
  return new NextResponse(lines.join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${seller.slug}-earnings.csv"` } });
}

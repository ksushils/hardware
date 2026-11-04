import { redirect } from "next/navigation";
import { currentMonth } from "@/lib/ledgerReports";

export default async function StatementIndex({ params, searchParams }: { params: Promise<{ sellerId: string }>; searchParams: Promise<{ ym?: string }> }) {
  const { sellerId } = await params;
  const { ym } = await searchParams;
  redirect(`/admin/finance/statements/${sellerId}/${/^\d{4}-(0[1-9]|1[0-2])$/.test(ym ?? "") ? ym : currentMonth()}`);
}

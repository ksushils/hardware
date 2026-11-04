import { notFound } from "next/navigation";
import { requireSeller } from "@/lib/sellerAuth";
import { sellerStatement } from "@/lib/ledgerReports";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/admin/ui";
import StatementView from "@/components/ledger/StatementView";

export const metadata = { title: "Statement" };

export default async function SellerStatementPage({ params }: { params: Promise<{ ym: string }> }) {
  const { seller } = await requireSeller();
  const { ym } = await params;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)) notFound();
  const [st, s] = await Promise.all([sellerStatement(seller.id, ym), getSettings()]); // strictly the logged-in seller's own data
  if (!st) notFound();
  return (
    <>
      <div className="print:hidden"><PageHeader title="Statement" back="/seller/statements" /></div>
      <StatementView st={st} storeName={s.storeName} legalName={s.legalName} trn={s.trn || undefined} basePath="/seller/statements" csvHref={`/seller/statements/${ym}/csv`} />
    </>
  );
}

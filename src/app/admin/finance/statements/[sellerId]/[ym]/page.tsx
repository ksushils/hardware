import { notFound } from "next/navigation";
import { sellerStatement } from "@/lib/ledgerReports";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/admin/ui";
import StatementView from "@/components/ledger/StatementView";

export default async function AdminStatement({ params }: { params: Promise<{ sellerId: string; ym: string }> }) {
  const { sellerId, ym } = await params;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)) notFound();
  const [st, s] = await Promise.all([sellerStatement(sellerId, ym), getSettings()]);
  if (!st) notFound();
  return (
    <>
      <div className="print:hidden"><PageHeader title={`Statement: ${st.seller.shopName}`} back={`/admin/sellers/${sellerId}`} subtitle="Admin view of the statement the seller sees in their portal." /></div>
      <StatementView st={st} storeName={s.storeName} legalName={s.legalName} trn={s.trn || undefined} basePath={`/admin/finance/statements/${sellerId}`} csvHref={`/admin/finance/export?type=statement&seller=${sellerId}&ym=${ym}`} />
    </>
  );
}

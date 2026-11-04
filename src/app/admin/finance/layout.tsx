import { requirePermission } from "@/lib/auth";
import FinanceNav from "./FinanceNav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Finance & ledger" };

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("sellers");
  return (
    <>
      <FinanceNav />
      {children}
    </>
  );
}

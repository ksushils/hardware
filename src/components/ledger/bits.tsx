import Link from "next/link";
import { formatMoney } from "@/lib/money";

export const money = (minor: number) => formatMoney(minor, "AED", "en-AE");

/** Debit/credit cell: shows the amount only in the column it belongs to. */
export function Dr({ v }: { v: number }) { return <span className="tabular-nums">{v > 0 ? money(v) : ""}</span>; }
export function Cr({ v }: { v: number }) { return <span className="tabular-nums">{v < 0 ? money(-v) : ""}</span>; }

export function Flash({ msg, error }: { msg?: string; error?: string }) {
  if (!msg && !error) return null;
  return <div className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`} role="status">{error ?? msg}</div>;
}

export function Mono({ children }: { children: React.ReactNode }) { return <span className="font-mono text-xs">{children}</span>; }

export function sourceLink(kind: string, refType: string, refId: string, orderNumbers: Record<string, string>) {
  if (refType === "ORDER" && orderNumbers[refId]) return <Link href={`/admin/orders/${orderNumbers[refId]}`} className="text-sky-700 underline">{orderNumbers[refId]}</Link>;
  if (refType === "REFUND" && orderNumbers[`refund:${refId}`]) return <Link href={`/admin/orders/${orderNumbers[`refund:${refId}`]}`} className="text-sky-700 underline">{orderNumbers[`refund:${refId}`]}</Link>;
  if (refType === "PAYOUT") return <Link href="/admin/sellers/payouts" className="text-sky-700 underline">payout</Link>;
  if (refType === "LEDGER_TX") return <Link href={`/admin/finance/ledger/${refId}`} className="text-sky-700 underline">original entry</Link>;
  return <Mono>{refId.slice(0, 12)}</Mono>;
}

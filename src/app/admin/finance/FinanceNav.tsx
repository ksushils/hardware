"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [["Overview", "/admin/finance"], ["Ledger", "/admin/finance/ledger"], ["Reconciliation", "/admin/finance/reconciliation"], ["Provider fees", "/admin/finance/fees"]] as const;

export default function FinanceNav() {
  const path = usePathname();
  const active = (h: string) => (h === "/admin/finance" ? path === h : path.startsWith(h));
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-slate-200">
      {TABS.map(([l, h]) => (
        <Link key={h} href={h} className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium ${active(h) ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{l}</Link>
      ))}
    </div>
  );
}

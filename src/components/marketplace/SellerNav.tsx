"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  ["Dashboard", "/seller", "🏠"], ["Products", "/seller/products", "🏷️"], ["Orders", "/seller/orders", "🧾"], ["Earnings", "/seller/earnings", "💰"],
  ["Payouts", "/seller/payouts", "🏦"], ["Reviews", "/seller/reviews", "⭐"], ["Messages", "/seller/messages", "✉️"], ["Shop settings", "/seller/settings", "⚙️"],
] as const;

export default function SellerNav({ unread }: { unread: number }) {
  const path = usePathname();
  const active = (h: string) => (h === "/seller" ? path === h : path.startsWith(h));
  return (
    <aside className="sticky top-12 hidden h-[calc(100vh-3rem)] w-56 shrink-0 border-e border-slate-200 bg-slate-50 p-2 md:block print:hidden">
      <nav className="space-y-0.5 text-sm">
        {NAV.map(([l, h, i]) => (
          <Link key={h} href={h} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 font-medium ${active(h) ? "bg-white text-slate-900 shadow-sm" : "text-slate-700 hover:bg-slate-200/60"}`}>
            <span className="w-5 text-center">{i}</span>{l}
            {h === "/seller/messages" && unread > 0 && <span className="ms-auto rounded-full bg-violet-600 px-1.5 text-xs text-white">{unread}</span>}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

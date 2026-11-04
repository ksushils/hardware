"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/app/admin/layout";

export default function AdminNav({ nav }: { nav: NavItem[] }) {
  const path = usePathname();
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(href + "/"));
  return (
    <aside className="sticky top-12 hidden h-[calc(100vh-3rem)] w-56 shrink-0 overflow-y-auto border-e border-slate-200 bg-slate-50 p-2 md:block print:hidden">
      <nav className="space-y-0.5 text-sm">
        {nav.map((n) => {
          const open = active(n.href) || n.children?.some((c) => active(c.href));
          return (
            <div key={n.href}>
              <Link href={n.href} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 font-medium ${active(n.href) ? "bg-white text-slate-900 shadow-sm" : "text-slate-700 hover:bg-slate-200/60"}`}>
                <span className="w-5 text-center">{n.icon}</span>{n.label}
              </Link>
              {open && n.children?.map((c) => (
                <Link key={c.href} href={c.href} className={`ms-7 block rounded-lg px-2.5 py-1 text-[13px] ${active(c.href) ? "bg-white font-semibold text-slate-900 shadow-sm" : "text-slate-600 hover:bg-slate-200/60"}`}>{c.label}</Link>
              ))}
            </div>
          );
        })}
      </nav>
      <div className="mt-6 border-t border-slate-200 pt-3 text-xs">
        <Link href="/account" className="block px-2.5 py-1 text-slate-500 hover:text-slate-800">My account</Link>
      </div>
    </aside>
  );
}

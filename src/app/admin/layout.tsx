import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { hasPermission, type Permission } from "@/lib/permissions";
import AdminNav from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";
export const metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false } };

export type NavItem = { label: string; href: string; icon: string; perm?: Permission; children?: { label: string; href: string }[] };

const NAV: NavItem[] = [
  { label: "Home", href: "/admin", icon: "🏠" },
  { label: "Orders", href: "/admin/orders", icon: "🧾", perm: "orders", children: [
    { label: "Drafts", href: "/admin/draft-orders" }, { label: "Abandoned checkouts", href: "/admin/abandoned" }, { label: "Returns", href: "/admin/returns" }, { label: "Trade-ins", href: "/admin/trade-ins" },
  ] },
  { label: "Products", href: "/admin/products", icon: "🏷️", perm: "products", children: [
    { label: "Collections", href: "/admin/collections" }, { label: "Inventory", href: "/admin/inventory" }, { label: "Import / export", href: "/admin/products/import" },
    { label: "Gift cards", href: "/admin/gift-cards" }, { label: "Reviews", href: "/admin/reviews" }, { label: "Questions", href: "/admin/questions" },
  ] },
  { label: "Customers", href: "/admin/customers", icon: "👤", perm: "customers", children: [{ label: "Subscribers", href: "/admin/subscribers" }] },
  { label: "Discounts", href: "/admin/discounts", icon: "🏷", perm: "discounts" },
  { label: "Content", href: "/admin/content/pages", icon: "📝", perm: "content", children: [
    { label: "Pages", href: "/admin/content/pages" }, { label: "Blog posts", href: "/admin/content/blog" }, { label: "Navigation", href: "/admin/content/navigation" }, { label: "Files", href: "/admin/content/files" }, { label: "URL redirects", href: "/admin/content/redirects" },
  ] },
  { label: "Analytics", href: "/admin/analytics", icon: "📊", perm: "analytics" },
  { label: "Marketplace", href: "/admin/sellers", icon: "🏪", perm: "sellers", children: [
    { label: "Sellers", href: "/admin/sellers" }, { label: "Product approvals", href: "/admin/sellers/products" }, { label: "Payouts", href: "/admin/sellers/payouts" }, { label: "Commission", href: "/admin/sellers/commission" }, { label: "Seller reviews", href: "/admin/sellers/reviews" },
  ] },
  { label: "Settings", href: "/admin/settings", icon: "⚙️", perm: "settings", children: [
    { label: "Staff", href: "/admin/settings/staff" }, { label: "Activity log", href: "/admin/settings/activity" },
  ] },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const s = await getSettings();
  const nav = NAV.filter((n) => !n.perm || hasPermission(user, n.perm));
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900" dir="ltr">
      <header className="sticky top-0 z-40 flex h-12 items-center justify-between bg-slate-900 px-4 text-white print:hidden">
        <Link href="/admin" className="flex items-center gap-2 font-bold"><span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-600 text-sm">T</span>{s.storeName} <span className="font-normal text-slate-400">Admin</span></Link>
        <form action="/admin/search" className="hidden w-96 md:block"><input name="q" placeholder="Search orders, products, customers" className="w-full rounded-lg bg-slate-800 px-3 py-1.5 text-sm outline-none placeholder:text-slate-400 focus:bg-slate-700" /></form>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/" target="_blank" className="text-slate-300 hover:text-white">View store ↗</Link>
          <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-700 text-xs font-bold" title={user.email}>{user.name.slice(0, 1).toUpperCase()}</span>
        </div>
      </header>
      <div className="flex">
        <AdminNav nav={nav} />
        <main className="min-w-0 flex-1 p-4 md:p-6 print:p-0"><div className="mx-auto max-w-6xl">{children}</div></main>
      </div>
    </div>
  );
}

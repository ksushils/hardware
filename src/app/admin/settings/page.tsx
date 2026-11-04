import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Settings" };

const SECTIONS = [
  { href: "general", icon: "🏪", title: "General", desc: "Store name, legal details, TRN, contact info, logo and social links" },
  { href: "theme", icon: "🎨", title: "Theme & homepage", desc: "Announcement bar, hero text and background video" },
  { href: "checkout", icon: "💳", title: "Checkout & payments", desc: "Card payments, cash on delivery, guest checkout, warranty and returns" },
  { href: "shipping", icon: "🚚", title: "Shipping & delivery", desc: "Delivery rates by emirate, free shipping thresholds, express" },
  { href: "taxes", icon: "🧾", title: "Taxes & duties", desc: "UAE VAT rate and invoice labels" },
  { href: "languages", icon: "🌐", title: "Languages", desc: "English and Arabic storefront" },
  { href: "notifications", icon: "✉️", title: "Notifications", desc: "Customer and staff emails, email log" },
  { href: "staff", icon: "👥", title: "Staff & permissions", desc: "Who can access the admin and what they can do", perm: "staff" as const },
  { href: "activity", icon: "🕘", title: "Activity log", desc: "Every change made in the admin" },
];

export default async function SettingsIndex() {
  const user = await requirePermission("settings");
  const s = await getSettings();
  return (
    <div>
      <PageHeader title="Settings" subtitle={`${s.storeName} · ${s.email}`} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.filter((x) => !x.perm || hasPermission(user, x.perm)).map((x) => (
          <Link key={x.href} href={`/admin/settings/${x.href}`} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-400">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-xl">{x.icon}</span>
            <span><span className="block font-semibold">{x.title}</span><span className="text-sm text-slate-500">{x.desc}</span></span>
          </Link>
        ))}
      </div>
    </div>
  );
}

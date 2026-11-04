import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getI18n, fmt } from "@/lib/i18n";
import { isStaff } from "@/lib/permissions";
import { db } from "@/lib/db";
import { logout } from "@/app/actions/auth";

export const metadata = { robots: { index: false } };

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { t, locale } = await getI18n();
  const seller = await db.seller.findUnique({ where: { userId: user.id }, select: { status: true } });
  const links: [string, string][] = [[t.account.profile, "/account"], [t.account.orders, "/account/orders"], [t.account.addresses, "/account/addresses"], [t.account.wishlist, "/account/wishlist"], [t.account.returns, "/account/returns"]];
  return (
    <div className="container-x py-8">
      <h1 className="text-3xl font-black">{fmt(t.account.hi, { name: user.name.split(" ")[0] })}</h1>
      <div className="mt-6 grid gap-6 md:grid-cols-[220px_1fr]">
        <nav className="card h-fit p-2 text-sm font-medium">
          {links.map(([l, h]) => <Link key={h} href={h} className="block rounded-lg px-3 py-2.5 hover:bg-slate-100">{l}</Link>)}
          {seller ? <Link href="/seller" className="block rounded-lg px-3 py-2.5 text-brand-700 hover:bg-brand-50">🏪 {locale === "ar" ? "لوحة البائع" : "Seller dashboard"}</Link>
            : <Link href="/become-a-seller" className="block rounded-lg px-3 py-2.5 text-slate-600 hover:bg-slate-100">🏪 {locale === "ar" ? "كن بائعًا" : "Become a seller"}</Link>}
          {isStaff(user) && <Link href="/admin" className="block rounded-lg px-3 py-2.5 text-brand-700 hover:bg-brand-50">{t.account.adminDashboard}</Link>}
          <form action={logout}><button className="w-full rounded-lg px-3 py-2.5 text-start text-red-600 hover:bg-red-50">{t.account.signOut}</button></form>
        </nav>
        <div>{children}</div>
      </div>
    </div>
  );
}

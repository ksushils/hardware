import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/actions/auth";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="container-x py-8">
      <h1 className="text-3xl font-black">Hi, {user.name.split(" ")[0]} 👋</h1>
      <div className="mt-6 grid gap-6 md:grid-cols-[220px_1fr]">
        <nav className="card h-fit p-2 text-sm font-medium">
          {[["Profile", "/account"], ["My orders", "/account/orders"], ["Addresses", "/account/addresses"], ["Wishlist", "/account/wishlist"]].map(([l, h]) => (
            <Link key={h} href={h} className="block rounded-lg px-3 py-2.5 hover:bg-slate-100">{l}</Link>
          ))}
          {user.role === "ADMIN" && <Link href="/admin" className="block rounded-lg px-3 py-2.5 text-brand-700 hover:bg-brand-50">Admin dashboard</Link>}
          <form action={logout}><button className="w-full rounded-lg px-3 py-2.5 text-left text-red-600 hover:bg-red-50">Sign out</button></form>
        </nav>
        <div>{children}</div>
      </div>
    </div>
  );
}

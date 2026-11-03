import Link from "next/link";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { cartCount } from "@/lib/cart";
import { CartIcon, HeartIcon, SearchIcon, UserIcon } from "./Icons";

export default async function Header() {
  const [user, count, categories] = await Promise.all([
    getUser(),
    cartCount(),
    db.category.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  const wishCount = user ? await db.wishlistItem.count({ where: { userId: user.id } }) : 0;

  return (
    <header className="sticky top-0 z-40 bg-white shadow-sm">
      <div className="bg-ink-900 text-xs text-white">
        <div className="container-x flex h-9 items-center justify-between gap-4">
          <p className="truncate">
            <span className="font-bold text-brand-500">LIMITED OFFER:</span> 10% off your first order with code{" "}
            <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono">WELCOME10</span>
          </p>
          <div className="hidden gap-5 sm:flex">
            <Link href="/help" className="hover:underline">Help Center</Link>
            <Link href="/track" className="hover:underline">Track Your Order</Link>
            <span>🇦🇪 UAE · AED</span>
          </div>
        </div>
      </div>

      <div className="container-x flex h-16 items-center gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-lg font-black text-white">T</span>
          <span className="hidden text-xl font-black tracking-tight sm:block">
            Tech<span className="text-brand-600">Revive</span>
          </span>
        </Link>

        <form action="/search" className="relative flex-1">
          <input name="q" placeholder="Search GPUs, CPUs, SSDs, monitors..." className="input rounded-full py-2.5 pl-11" />
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        </form>

        <nav className="flex items-center gap-1">
          <Link href={user ? "/account" : "/login"} className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-slate-100" title="Account">
            <UserIcon />
            <span className="hidden text-sm font-medium lg:block">{user ? user.name.split(" ")[0] : "Sign in"}</span>
          </Link>
          {user?.role === "ADMIN" && (
            <Link href="/admin" className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 md:block">Admin</Link>
          )}
          <Link href="/account/wishlist" className="relative rounded-xl p-2 hover:bg-slate-100" title="Wishlist">
            <HeartIcon />
            {wishCount > 0 && <Badge n={wishCount} />}
          </Link>
          <Link href="/cart" className="relative rounded-xl p-2 hover:bg-slate-100" title="Cart">
            <CartIcon />
            {count > 0 && <Badge n={count} />}
          </Link>
        </nav>
      </div>

      <div className="border-t border-slate-100">
        <div className="container-x flex gap-1 overflow-x-auto py-2 text-sm font-medium [scrollbar-width:none]">
          <Link href="/deals" className="whitespace-nowrap rounded-lg px-3 py-1.5 font-bold text-accent hover:bg-red-50">🔥 Hot Deals</Link>
          <Link href="/express" className="whitespace-nowrap rounded-lg px-3 py-1.5 hover:bg-slate-100">⚡ Express 24h</Link>
          {categories.map((c) => (
            <Link key={c.id} href={`/category/${c.slug}`} className="whitespace-nowrap rounded-lg px-3 py-1.5 text-slate-700 hover:bg-slate-100">
              {c.name}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}

function Badge({ n }: { n: number }) {
  return (
    <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white">
      {n > 99 ? "99+" : n}
    </span>
  );
}

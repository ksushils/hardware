import Link from "next/link";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { cartCount } from "@/lib/cart";
import { getI18n } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { isStaff } from "@/lib/permissions";
import { loc } from "@/lib/format";
import LiveSearch from "./LiveSearch";
import CompareLink from "./Compare";
import { CartIcon, HeartIcon, UserIcon } from "./Icons";

export default async function Header() {
  const [user, count, categories, { t, locale }, s] = await Promise.all([
    getUser(), cartCount(), db.category.findMany({ orderBy: { sortOrder: "asc" } }), getI18n(), getSettings(),
  ]);
  const wishCount = user ? await db.wishlistItem.count({ where: { userId: user.id } }) : 0;
  const storeName = loc(locale, s.storeName, s.storeNameAr);

  return (
    <header className="sticky top-0 z-40 bg-white shadow-sm">
      <div className="bg-ink-900 text-xs text-white">
        <div className="container-x flex h-9 items-center justify-between gap-4">
          <p className="truncate">{s.announcement.enabled ? loc(locale, s.announcement.text, s.announcement.textAr) : ""}</p>
          <div className="flex shrink-0 items-center gap-4">
            <Link href="/become-a-seller" className="font-semibold text-brand-500 hover:underline">🏪 {locale === "ar" ? "كن بائعًا" : "Become a seller"}</Link>
            <Link href="/help" className="hidden hover:underline sm:inline">{t.header.helpCenter}</Link>
            <Link href="/track" className="hidden hover:underline sm:inline">{t.header.trackOrder}</Link>
            {s.languages.arabicEnabled && (
              <a href={`?lang=${locale === "ar" ? "en" : "ar"}`} hrefLang={locale === "ar" ? "en" : "ar"} className="rounded bg-white/10 px-2 py-0.5 font-semibold hover:bg-white/20" lang={locale === "ar" ? "en" : "ar"}>
                {t.switchTo}
              </a>
            )}
            <span className="hidden md:inline">🇦🇪 AED</span>
          </div>
        </div>
      </div>

      <div className="container-x flex h-16 items-center gap-3 md:gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label={storeName}>
          {s.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.logoUrl} alt={storeName} className="h-9 w-auto" />
          ) : (
            <>
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-lg font-black text-white">T</span>
              <span className="hidden text-xl font-black tracking-tight sm:block" dir="ltr">Tech<span className="text-brand-600">Revive</span></span>
            </>
          )}
        </Link>
        <LiveSearch />
        <nav className="flex items-center gap-0.5">
          <Link href={user ? "/account" : "/login"} className="flex items-center gap-2 rounded-xl px-2.5 py-2 hover:bg-slate-100" title={t.common.account}>
            <UserIcon />
            <span className="hidden text-sm font-medium lg:block">{user ? user.name.split(" ")[0] : t.common.signIn}</span>
          </Link>
          {isStaff(user) && <Link href="/admin" className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 md:block">{t.common.admin}</Link>}
          <CompareLink />
          <Link href="/account/wishlist" className="relative rounded-xl p-2 hover:bg-slate-100" title={t.common.wishlist} aria-label={t.common.wishlist}>
            <HeartIcon />
            {wishCount > 0 && <Badge n={wishCount} />}
          </Link>
          <Link href="/cart" className="relative rounded-xl p-2 hover:bg-slate-100" title={t.common.cart} aria-label={t.common.cart}>
            <CartIcon />
            {count > 0 && <Badge n={count} />}
          </Link>
        </nav>
      </div>

      <div className="border-t border-slate-100">
        <div className="container-x flex gap-1 overflow-x-auto py-2 text-sm font-medium [scrollbar-width:none]">
          <Link href="/deals" className="whitespace-nowrap rounded-lg px-3 py-1.5 font-bold text-accent hover:bg-red-50">{t.header.hotDeals}</Link>
          <Link href="/build" className="whitespace-nowrap rounded-lg px-3 py-1.5 font-semibold text-brand-700 hover:bg-brand-50">🛠️ {locale === "ar" ? "جمّع جهازك" : "PC Builder"}</Link>
          <Link href="/express" className="whitespace-nowrap rounded-lg px-3 py-1.5 hover:bg-slate-100">{t.header.express}</Link>
          {categories.map((c) => (
            <Link key={c.id} href={`/category/${c.slug}`} className="whitespace-nowrap rounded-lg px-3 py-1.5 text-slate-700 hover:bg-slate-100">{loc(locale, c.name, c.nameAr)}</Link>
          ))}
          {s.mainMenu.map((m) => <Link key={m.url} href={m.url} className="whitespace-nowrap rounded-lg px-3 py-1.5 text-slate-700 hover:bg-slate-100">{loc(locale, m.label, m.labelAr)}</Link>)}
          <Link href="/collections" className="whitespace-nowrap rounded-lg px-3 py-1.5 text-slate-700 hover:bg-slate-100">{t.header.collections}</Link>
          <Link href="/blog" className="whitespace-nowrap rounded-lg px-3 py-1.5 text-slate-700 hover:bg-slate-100">{t.header.blog}</Link>
          <Link href="/sellers" className="whitespace-nowrap rounded-lg px-3 py-1.5 text-slate-700 hover:bg-slate-100">{locale === "ar" ? "المتاجر" : "Shops"}</Link>
          <Link href="/become-a-seller" className="whitespace-nowrap rounded-lg px-3 py-1.5 font-semibold text-brand-700 hover:bg-brand-50">🏪 {locale === "ar" ? "كن بائعًا" : "Sell on TechRevive"}</Link>
        </div>
      </div>
    </header>
  );
}

function Badge({ n }: { n: number }) {
  return <span className="absolute -end-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white">{n > 99 ? "99+" : n}</span>;
}

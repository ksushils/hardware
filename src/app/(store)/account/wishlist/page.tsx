import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { productInclude, bestVariant, listedProducts } from "@/lib/catalog";
import { getI18n } from "@/lib/i18n";
import { aed, loc, pctOff } from "@/lib/format";
import { isAvailable } from "@/lib/inventory";
import { moveWishlistToCart } from "@/app/actions/cart";
import { toggleWishlist } from "@/app/actions/account";

export const metadata = { title: "Wishlist" };

export default async function WishlistPage() {
  const user = await requireUser("/account/wishlist");
  const { t, locale } = await getI18n();
  const rawItems = await db.wishlistItem.findMany({ where: { userId: user.id }, include: { product: { include: productInclude } }, orderBy: { id: "desc" } });
  // hide offers that are no longer listed (suspended seller, unapproved, vacation)
  const items = rawItems.flatMap((i) => { const [p] = listedProducts([i.product]); return p ? [{ ...i, product: p }] : []; });
  if (!items.length) return <p className="card p-10 text-center text-slate-500">{t.wishlist.empty}</p>;
  const availableIds = items.filter((i) => i.product.variants.some(isAvailable)).map((i) => i.productId);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{t.wishlist.title} ({items.length})</h2>
        {availableIds.length > 0 && (
          <form action={moveWishlistToCart}>
            {availableIds.map((id) => <input key={id} type="hidden" name="productId" value={id} />)}
            <input type="hidden" name="go" value="cart" />
            <button className="btn-primary py-2">🛒 {t.wishlist.moveAll}</button>
          </form>
        )}
      </div>
      <div className="grid gap-3">
        {items.map(({ product: p }) => {
          const b = bestVariant(p);
          const available = p.variants.some(isAvailable);
          const off = b ? pctOff(b.price, p.priceNew) : 0;
          return (
            <div key={p.id} className="card flex items-center gap-4 p-4">
              <Link href={`/products/${p.slug}`} className="h-20 w-20 shrink-0 rounded-xl bg-slate-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image} alt="" className="h-full w-full object-contain p-2" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/products/${p.slug}`} className="font-semibold hover:underline">{p.brand} {loc(locale, p.name, p.nameAr)}</Link>
                <p className="text-sm">{t.common.from} <b>{aed(b?.price ?? 0, locale)}</b> {off > 0 && <span className="text-xs font-bold text-accent">-{off}%</span>}</p>
                <p className={`text-xs ${available ? "text-brand-700" : "text-slate-400"}`}>{available ? t.common.inStock : t.common.soldOut}</p>
              </div>
              <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
                {available ? (
                  <form action={moveWishlistToCart}><input type="hidden" name="productId" value={p.id} /><button className="btn-dark py-2 text-xs">🛒 {t.wishlist.moveToCart}</button></form>
                ) : <Link href={`/products/${p.slug}`} className="btn-outline py-2 text-xs">🔔 {t.product.notifyMe}</Link>}
                <form action={toggleWishlist}><input type="hidden" name="productId" value={p.id} /><button className="text-xs text-slate-500 hover:text-red-600">{t.common.remove}</button></form>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { productInclude } from "@/lib/catalog";
import { ProductGrid } from "@/components/ProductCard";

export const metadata = { title: "Wishlist" };

export default async function WishlistPage() {
  const user = await requireUser("/account/wishlist");
  const items = await db.wishlistItem.findMany({ where: { userId: user.id }, include: { product: { include: productInclude } } });
  return items.length ? <ProductGrid products={items.map((i) => i.product)} /> : <p className="card p-10 text-center text-slate-500">Your wishlist is empty. Tap ♡ on any product to save it.</p>;
}

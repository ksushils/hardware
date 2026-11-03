import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { productInclude } from "@/lib/catalog";
import { CONDITION_ORDER, parseSpecs } from "@/lib/format";
import { toggleWishlist } from "@/app/actions/account";
import BuyBox from "@/components/BuyBox";
import ReviewForm from "@/components/ReviewForm";
import { ProductGrid } from "@/components/ProductCard";
import { BoltIcon, HeartIcon, StarIcon } from "@/components/Icons";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const p = await db.product.findUnique({ where: { slug: (await params).slug } });
  return p ? { title: `${p.brand} ${p.name}`, description: p.description } : {};
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await db.product.findUnique({
    where: { slug },
    include: { variants: true, category: true, reviews: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" } } },
  });
  if (!product || !product.active) notFound();
  const user = await getUser();
  const wished = user ? !!(await db.wishlistItem.findUnique({ where: { userId_productId: { userId: user.id, productId: product.id } } })) : false;
  const related = await db.product.findMany({
    where: { categoryId: product.categoryId, active: true, id: { not: product.id } }, include: productInclude, take: 4,
  });
  const specs = parseSpecs(product.specs);
  const variants = [...product.variants].sort((a, b) => CONDITION_ORDER.indexOf(a.condition as never) - CONDITION_ORDER.indexOf(b.condition as never));
  const avg = product.reviews.length ? product.reviews.reduce((s, r) => s + r.rating, 0) / product.reviews.length : 0;

  return (
    <div className="container-x py-8">
      <nav className="text-sm text-slate-500">
        <Link href="/" className="hover:underline">Home</Link> / <Link href={`/category/${product.category.slug}`} className="hover:underline">{product.category.name}</Link> / <span className="text-slate-800">{product.name}</span>
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div className="card relative aspect-square overflow-hidden">
          <Image src={product.image} alt={product.name} fill priority className="object-contain p-10" unoptimized={product.image.endsWith(".svg")} />
          {product.express && <span className="absolute left-4 top-4 flex items-center gap-1 rounded-full bg-ink-900 px-3 py-1.5 text-xs font-bold text-white"><BoltIcon className="h-3.5 w-3.5" /> Express 24h</span>}
        </div>
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{product.brand}</p>
              <h1 className="mt-1 text-2xl font-black leading-tight md:text-3xl">{product.name}</h1>
              {product.reviews.length > 0 && (
                <p className="mt-2 flex items-center gap-1 text-sm text-amber-500"><StarIcon filled /> <span className="text-slate-700">{avg.toFixed(1)} · {product.reviews.length} review(s)</span></p>
              )}
            </div>
            <form action={toggleWishlist}>
              <input type="hidden" name="productId" value={product.id} />
              <input type="hidden" name="path" value={`/products/${slug}`} />
              <button className={`rounded-full border p-3 ${wished ? "border-red-200 bg-red-50 text-accent" : "border-slate-200 hover:bg-slate-100"}`} title="Wishlist">
                <HeartIcon className={`h-5 w-5 ${wished ? "fill-current" : ""}`} />
              </button>
            </form>
          </div>
          <div className="card mt-6 p-5">
            <BuyBox variants={variants.map(({ id, condition, price, stock }) => ({ id, condition, price, stock }))} priceNew={product.priceNew} express={product.express} />
          </div>
        </div>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-xl font-bold">Description</h2>
          <p className="mt-3 leading-relaxed text-slate-700">{product.description}</p>
          <h2 className="mt-8 text-xl font-bold">Specifications</h2>
          <table className="card mt-3 w-full overflow-hidden text-sm">
            <tbody>
              {Object.entries(specs).map(([k, v], i) => (
                <tr key={k} className={i % 2 ? "bg-slate-50" : ""}>
                  <td className="w-1/3 px-4 py-2.5 font-medium text-slate-600">{k}</td>
                  <td className="px-4 py-2.5">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section>
          <h2 className="text-xl font-bold">Customer reviews</h2>
          <div className="mt-3 space-y-3">
            {product.reviews.length === 0 && <p className="text-sm text-slate-500">No reviews yet. Be the first!</p>}
            {product.reviews.map((r) => (
              <div key={r.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{r.user.name}</p>
                  <span className="flex text-amber-400">{[1, 2, 3, 4, 5].map((i) => <StarIcon key={i} filled={i <= r.rating} />)}</span>
                </div>
                <p className="mt-2 text-sm text-slate-700">{r.comment}</p>
              </div>
            ))}
            {user ? <ReviewForm productId={product.id} /> : <p className="text-sm"><Link href={`/login?next=/products/${slug}`} className="font-semibold text-brand-700 underline">Log in</Link> to write a review.</p>}
          </div>
        </section>
      </div>

      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="h-section">You may also like</h2>
          <div className="mt-6"><ProductGrid products={related} /></div>
        </section>
      )}
    </div>
  );
}

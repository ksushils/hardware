import Link from "next/link";
import Image from "next/image";
import { getCartDetails } from "@/lib/cart";
import { aed, conditionLabel } from "@/lib/format";
import { computeTotals, FREE_SHIPPING_MIN, warrantyPrice } from "@/lib/pricing";
import { removeCartItem, toggleWarranty, updateCartItem } from "@/app/actions/cart";
import TrustBar from "@/components/TrustBar";

export const metadata = { title: "Your Cart" };
export const dynamic = "force-dynamic";

export default async function CartPage({ searchParams }: { searchParams: Promise<{ added?: string }> }) {
  const { added } = await searchParams;
  const { items } = await getCartDetails();
  const totals = computeTotals(items.map((i) => ({ price: i.variant.price, quantity: i.quantity, warranty: i.warranty })));

  if (!items.length)
    return (
      <div className="container-x py-20 text-center">
        <h1 className="text-3xl font-black">Your cart is empty</h1>
        <p className="mt-2 text-slate-600">Find your next upgrade from our certified renewed range.</p>
        <Link href="/deals" className="btn-primary mt-6">Shop Hot Deals</Link>
      </div>
    );

  return (
    <div className="container-x py-8">
      {added && <div className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700">✓ Item added to your cart</div>}
      <h1 className="text-3xl font-black">Shopping cart</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {items.map((i) => (
            <div key={i.variant.id} className="card flex gap-4 p-4">
              <Link href={`/products/${i.product.slug}`} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-50">
                <Image src={i.product.image} alt="" fill className="object-contain p-2" unoptimized />
              </Link>
              <div className="flex flex-1 flex-col">
                <div className="flex justify-between gap-3">
                  <div>
                    <Link href={`/products/${i.product.slug}`} className="font-semibold hover:underline">{i.product.brand} {i.product.name}</Link>
                    <p className="text-sm text-slate-500">Condition: {conditionLabel(i.variant.condition)}</p>
                    {i.quantity < i.requested && <p className="text-sm text-red-600">Only {i.variant.stock} available. Quantity adjusted.</p>}
                  </div>
                  <p className="font-bold whitespace-nowrap">{aed(i.variant.price * i.quantity)}</p>
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-3 pt-3">
                  <form action={updateCartItem} className="flex items-center rounded-lg border border-slate-300">
                    <input type="hidden" name="variantId" value={i.variant.id} />
                    <button name="quantity" value={i.quantity - 1} className="px-3 py-1.5 hover:bg-slate-100" aria-label="Decrease">−</button>
                    <span className="w-8 text-center text-sm font-semibold">{i.quantity}</span>
                    <button name="quantity" value={i.quantity + 1} className="px-3 py-1.5 hover:bg-slate-100 disabled:opacity-30" disabled={i.quantity >= i.variant.stock} aria-label="Increase">+</button>
                  </form>
                  <form action={toggleWarranty}>
                    <input type="hidden" name="variantId" value={i.variant.id} />
                    <button className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${i.warranty ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-300"}`}>
                      {i.warranty ? "✓ Care+ added" : "+ Care+"} ({aed(warrantyPrice(i.variant.price))}/unit)
                    </button>
                  </form>
                  <form action={removeCartItem} className="ml-auto">
                    <input type="hidden" name="variantId" value={i.variant.id} />
                    <button className="text-sm text-slate-500 hover:text-red-600">Remove</button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>
        <aside className="card h-fit space-y-3 p-5 lg:sticky lg:top-36">
          <h2 className="text-lg font-bold">Order summary</h2>
          <Row l="Subtotal" r={aed(totals.subtotal)} />
          <Row l="Delivery" r={totals.shipping ? aed(totals.shipping) : "FREE"} />
          {totals.shipping > 0 && <p className="text-xs text-slate-500">Add {aed(FREE_SHIPPING_MIN - totals.subtotal)} more for free delivery.</p>}
          <div className="border-t pt-3"><Row l={<b>Total</b>} r={<b className="text-lg">{aed(totals.total)}</b>} /></div>
          <p className="text-xs text-slate-500">Includes VAT of {aed(totals.vat)}. Coupons are applied at checkout.</p>
          <Link href="/checkout" className="btn-primary w-full">Proceed to checkout</Link>
          <Link href="/" className="btn-outline w-full">Continue shopping</Link>
        </aside>
      </div>
      <div className="mt-10"><TrustBar /></div>
    </div>
  );
}

function Row({ l, r }: { l: React.ReactNode; r: React.ReactNode }) {
  return <div className="flex justify-between text-sm"><span>{l}</span><span>{r}</span></div>;
}

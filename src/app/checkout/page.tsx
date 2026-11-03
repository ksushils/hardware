import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { getCartDetails } from "@/lib/cart";
import { stripeEnabled } from "@/lib/payments";
import CheckoutForm from "./CheckoutForm";

export const metadata = { title: "Checkout" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const { items } = await getCartDetails();
  if (!items.length) redirect("/cart");
  const user = await getUser();
  const addresses = user ? await db.address.findMany({ where: { userId: user.id }, orderBy: { isDefault: "desc" } }) : [];
  return (
    <div className="container-x py-8">
      <h1 className="text-3xl font-black">Checkout</h1>
      <CheckoutForm
        user={user ? { email: user.email, name: user.name, phone: user.phone ?? "" } : null}
        addresses={addresses}
        stripe={stripeEnabled()}
        items={items.map((i) => ({
          id: i.variant.id, name: `${i.product.brand} ${i.product.name}`, condition: i.variant.condition,
          image: i.product.image, price: i.variant.price, quantity: i.quantity, warranty: i.warranty, express: i.product.express,
        }))}
      />
    </div>
  );
}

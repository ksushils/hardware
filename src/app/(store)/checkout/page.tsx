import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { getCartDetails } from "@/lib/cart";
import { getSettings, pricingConfig } from "@/lib/settings";
import { cardPaymentsAvailable, stripeEnabled } from "@/lib/payments";
import { bestAutomaticDiscount } from "@/lib/discounts";
import { getI18n } from "@/lib/i18n";
import { resolveCheckoutCart } from "@/lib/shipments";
import { loc } from "@/lib/format";
import CheckoutForm from "./CheckoutForm";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const cart = await getCartDetails();
  if (!cart.entries.length) redirect("/cart");
  const resolved = await resolveCheckoutCart(cart.items, cart.entries);
  // Offers that were hidden/sold out since they were added are handled (with a clear message) on the cart page.
  if (resolved.blocked.length || !resolved.items.length) redirect("/cart");
  const items = resolved.items;
  const [user, s, { t, locale }] = await Promise.all([getUser(), getSettings(), getI18n()]);
  if (!user && !s.checkout.guestCheckout) redirect("/login?next=/checkout");
  const addresses = user ? await db.address.findMany({ where: { userId: user.id }, orderBy: { isDefault: "desc" } }) : [];
  const rates = await db.shippingRate.findMany({ where: { active: true }, orderBy: { position: "asc" } });
  const auto = await bestAutomaticDiscount(items.map((i) => ({ productId: i.product.id, price: i.variant.price, quantity: i.quantity })), user?.email);
  return (
    <div className="container-x py-8">
      <h1 className="text-3xl font-black">{t.checkout.title}</h1>
      <CheckoutForm
        user={user ? { email: user.email, name: user.name, phone: user.phone ?? "" } : null}
        addresses={addresses}
        stripe={stripeEnabled()}
        cfg={pricingConfig(s)}
        checkoutCfg={{ cardEnabled: s.checkout.cardEnabled && cardPaymentsAvailable(), codEnabled: s.checkout.codEnabled, codMax: s.checkout.codMax, orderNotes: s.checkout.orderNotes, marketingOptIn: s.checkout.marketingOptIn, bnpl: s.checkout.bnplMessage }}
        rates={rates.map((r) => ({ id: r.id, name: r.name, nameAr: r.nameAr, emirates: r.emirates, price: r.price, freeAbove: r.freeAbove, minOrder: r.minOrder, maxOrder: r.maxOrder, expressOnly: r.expressOnly, deliveryDays: r.deliveryDays }))}
        automatic={auto}
        storeName={loc(locale, s.storeName, s.storeNameAr)}
        sellers={Object.values(resolved.sellers)}
        carrier={{ min: s.delivery.carrierMinDays, max: s.delivery.carrierMaxDays }}
        items={items.map((i) => ({
          id: i.variant.id, productId: i.product.id, name: `${i.product.brand} ${i.product.name}`, nameAr: i.product.nameAr ? `${i.product.brand} ${i.product.nameAr}` : "",
          variantTitle: i.variant.title === "Default Title" ? "" : i.variant.title, image: i.variant.image || i.product.image, price: i.variant.price, quantity: i.quantity, warranty: i.warranty, express: i.product.express,
          sellerId: i.variant.sellerId, handlingDays: i.variant.handlingDays,
        }))}
      />
    </div>
  );
}

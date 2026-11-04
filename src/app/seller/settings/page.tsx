import { requireSeller } from "@/lib/sellerAuth";
import { PageHeader } from "@/components/admin/ui";
import ShopSettingsForm from "@/components/marketplace/ShopSettingsForm";

export const metadata = { title: "Shop settings" };

export default async function SellerSettings() {
  const { seller: s } = await requireSeller();
  let social: Record<string, string> = {};
  try { social = JSON.parse(s.social); } catch {}
  return (
    <>
      <PageHeader title="Shop settings" subtitle={`Public URL: /sellers/${s.slug}`} />
      <ShopSettingsForm s={{
        shopName: s.shopName, email: s.email, phone: s.phone, address: s.address, about: s.about, aboutAr: s.aboutAr, returnPolicy: s.returnPolicy, shippingPolicy: s.shippingPolicy,
        bankName: s.bankName ?? "", accountName: s.accountName ?? "", iban: s.iban ?? "", flatShippingFee: s.flatShippingFee, freeShippingOver: s.freeShippingOver,
        vacationMode: s.vacationMode, vacationMessage: s.vacationMessage ?? "", vacationUntil: s.vacationUntil?.toISOString().slice(0, 10) ?? "", logoUrl: s.logoUrl, bannerUrl: s.bannerUrl, social,
      }} />
    </>
  );
}

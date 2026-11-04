import { redirect } from "next/navigation";
import { getI18n } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { getSellerForUser } from "@/lib/sellerAuth";
import ApplyForm from "@/components/marketplace/ApplyForm";

export const metadata = { title: "Seller application", robots: { index: false } };

export default async function ApplyPage() {
  const [{ locale }, s, { user, seller }] = await Promise.all([getI18n(), getSettings(), getSellerForUser()]);
  if (!user) redirect("/login?next=/become-a-seller/apply");
  if (seller) redirect(seller.status === "APPROVED" ? "/seller" : "/seller/status");
  const ar = locale === "ar";
  return (
    <div className="container-x max-w-3xl py-10">
      <h1 className="text-3xl font-black">{ar ? "طلب التسجيل كبائع" : "Apply to sell on TechRevive"}</h1>
      <p className="mb-6 mt-1 text-slate-600">{ar ? "يستغرق حوالي 5 دقائق. جهّز رخصتك التجارية." : "Takes about 5 minutes. Have your trade licence ready."}</p>
      {!s.marketplace.enabled ? <p className="card p-6">{ar ? "التسجيل مغلق حاليًا." : "Seller registration is currently closed."}</p> : <ApplyForm email={user.email} phone={user.phone ?? ""} terms={ar ? s.marketplace.sellerTermsAr : s.marketplace.sellerTerms} />}
    </div>
  );
}

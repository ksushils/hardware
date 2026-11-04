import Link from "next/link";
import { redirect } from "next/navigation";
import { getSellerForUser } from "@/lib/sellerAuth";

export const metadata = { title: "Application status" };

export default async function SellerStatus() {
  const { user, seller } = await getSellerForUser();
  if (!user) redirect("/login?next=/seller/status");
  if (!seller) redirect("/become-a-seller");
  if (seller.status === "APPROVED") redirect("/seller");
  const info: Record<string, [string, string, string]> = {
    PENDING: ["⏳", "Your application is under review", "Our team checks your trade licence and details, usually within 2 business days. We'll email you at " + seller.email + " once it's approved."],
    REJECTED: ["❌", "Your application wasn't approved", "You can reply to our email with updated documents and we'll review it again."],
    SUSPENDED: ["⛔", "Your shop is suspended", "Your products are hidden from the store. Contact marketplace support to resolve this."],
  };
  const [icon, title, text] = info[seller.status] ?? info.PENDING;
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <p className="text-5xl">{icon}</p>
      <h1 className="mt-3 text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-slate-600">{text}</p>
      {seller.rejectionReason && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"><b>Reason:</b> {seller.rejectionReason}</p>}
      <dl className="mt-6 grid grid-cols-2 gap-2 text-start text-sm">
        <dt className="text-slate-500">Shop</dt><dd className="font-medium">{seller.shopName}</dd>
        <dt className="text-slate-500">Shop URL</dt><dd className="font-medium">/sellers/{seller.slug}</dd>
        <dt className="text-slate-500">Applied</dt><dd className="font-medium">{seller.createdAt.toLocaleDateString("en-AE")}</dd>
      </dl>
      <Link href="/" className="btn-a mt-6">Back to store</Link>
    </div>
  );
}

import Link from "next/link";
import { getSellerForUser } from "@/lib/sellerAuth";
import { db } from "@/lib/db";
import SellerNav from "@/components/marketplace/SellerNav";

export const dynamic = "force-dynamic";
export const metadata = { title: { default: "Seller portal", template: "%s · Seller portal" }, robots: { index: false } };

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const { seller } = await getSellerForUser();
  const approved = seller?.status === "APPROVED";
  const unread = approved ? await db.sellerMessage.count({ where: { sellerId: seller!.id, readAt: null } }) : 0;
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900" dir="ltr">
      <header className="sticky top-0 z-40 flex h-12 items-center justify-between bg-violet-950 px-4 text-white print:hidden">
        <Link href="/seller" className="flex items-center gap-2 font-bold"><span className="grid h-7 w-7 place-items-center rounded-lg bg-violet-500 text-sm">🏪</span>{seller?.shopName ?? "Seller portal"} <span className="font-normal text-violet-300">Seller Centre</span></Link>
        <div className="flex items-center gap-4 text-sm">
          {approved && <Link href={`/sellers/${seller!.slug}`} target="_blank" className="text-violet-200 hover:text-white">View my shop ↗</Link>}
          <Link href="/" className="text-violet-200 hover:text-white">Store</Link>
          <Link href="/account" className="text-violet-200 hover:text-white">My account</Link>
        </div>
      </header>
      <div className="flex">
        {approved && <SellerNav unread={unread} />}
        <main className="min-w-0 flex-1 p-4 md:p-6 print:p-0"><div className="mx-auto max-w-6xl">{children}</div></main>
      </div>
    </div>
  );
}

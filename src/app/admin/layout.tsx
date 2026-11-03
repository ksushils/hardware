import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="container-x py-8">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-4 text-2xl font-black">Admin</h1>
        {[["Dashboard", "/admin"], ["Products", "/admin/products"], ["Orders", "/admin/orders"], ["Coupons", "/admin/coupons"]].map(([l, h]) => (
          <Link key={h} href={h} className="rounded-lg bg-white px-3 py-2 text-sm font-semibold shadow-sm hover:bg-slate-100">{l}</Link>
        ))}
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}

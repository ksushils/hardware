import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n";
import { EMIRATES_AR } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  return { title: locale === "ar" ? "متاجر البائعين" : "Marketplace sellers", description: locale === "ar" ? "تصفح البائعين الموثوقين لقطع الكمبيوتر في الإمارات." : "Browse trusted PC hardware sellers across the UAE.", alternates: { canonical: "/sellers" } };
}

export default async function SellersDirectory({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string }> }) {
  const { locale } = await getI18n();
  const ar = locale === "ar";
  const sp = await searchParams;
  const sellers = await db.seller.findMany({
    where: { status: "APPROVED", ...(sp.q ? { OR: [{ shopName: { contains: sp.q } }, { about: { contains: sp.q } }] } : {}) },
    include: { _count: { select: { products: { where: { status: "ACTIVE", approvalStatus: "APPROVED" } } } } },
    orderBy: sp.sort === "new" ? { createdAt: "desc" } : sp.sort === "name" ? { shopName: "asc" } : [{ ratingAvg: "desc" }, { ratingCount: "desc" }],
  });
  return (
    <div className="container-x py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">{ar ? "متاجر البائعين" : "Marketplace sellers"}</h1>
          <p className="mt-1 text-slate-600">{ar ? "بائعون موثوقون ومرخصون في الإمارات." : "Licensed, vetted sellers from across the UAE."}</p>
        </div>
        <Link href="/become-a-seller" className="btn-outline">{ar ? "بِع معنا" : "Become a seller"}</Link>
      </div>
      <form className="mt-6 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder={ar ? "ابحث عن متجر…" : "Search shops…"} className="input max-w-sm" />
        <select name="sort" defaultValue={sp.sort ?? ""} className="input w-auto">
          <option value="">{ar ? "الأعلى تقييمًا" : "Top rated"}</option><option value="new">{ar ? "الأحدث" : "Newest"}</option><option value="name">{ar ? "الاسم" : "Name"}</option>
        </select>
        <button className="btn-dark">{ar ? "بحث" : "Search"}</button>
      </form>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sellers.map((s) => (
          <Link key={s.id} href={`/sellers/${s.slug}`} className="card group overflow-hidden transition hover:shadow-lg">
            <div className="h-24 bg-gradient-to-r from-violet-700 to-brand-600" style={s.bannerUrl ? { backgroundImage: `url(${s.bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
            <div className="-mt-8 p-4">
              <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl border-4 border-white bg-white text-2xl shadow">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {s.logoUrl ? <img src={s.logoUrl} alt="" className="h-full w-full object-contain" /> : "🏪"}
              </div>
              <p className="mt-2 text-lg font-bold group-hover:text-brand-700">{s.shopName}</p>
              <p className="text-sm text-slate-500">📍 {ar ? EMIRATES_AR[s.emirate] ?? s.emirate : s.emirate} · {s._count.products} {ar ? "منتج" : "products"}</p>
              <p className="mt-1 text-sm">{s.ratingCount ? <><span className="text-amber-500">★ {s.ratingAvg}</span> <span className="text-slate-500">({s.ratingCount})</span></> : <span className="text-slate-400">{ar ? "بائع جديد" : "New seller"}</span>}</p>
              {s.vacationMode && <p className="mt-1 text-xs font-semibold text-amber-600">🏖️ {ar ? "في إجازة" : "On vacation"}</p>}
            </div>
          </Link>
        ))}
        {!sellers.length && <p className="card p-8 text-center text-slate-500 sm:col-span-2 lg:col-span-3">{ar ? "لا توجد متاجر." : "No sellers found."}</p>}
      </div>
    </div>
  );
}

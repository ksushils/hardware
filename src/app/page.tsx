import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { productInclude, searchProducts } from "@/lib/catalog";
import { ProductGrid } from "@/components/ProductCard";
import TrustBar from "@/components/TrustBar";
import { BoltIcon, CheckIcon, StarIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [categories, featured, deals, gpus] = await Promise.all([
    db.category.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { products: true } } } }),
    searchProducts({ featured: true }),
    searchProducts({ sort: "discount", inStock: true }),
    db.product.findMany({ where: { active: true, category: { slug: "graphics-cards" } }, include: productInclude, take: 4 }),
  ]);

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-ink-900 via-ink-800 to-brand-700 text-white">
        <div className="container-x grid items-center gap-10 py-14 md:grid-cols-2 md:py-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
              <span className="h-2 w-2 rounded-full bg-brand-500" /> Certified Renewed · Tested in Dubai
            </span>
            <h1 className="mt-5 text-4xl font-black leading-tight tracking-tight md:text-6xl">
              Premium PC hardware.<br /><span className="text-brand-500">Up to 60% off</span> new.
            </h1>
            <p className="mt-5 max-w-lg text-lg text-slate-300">
              GPUs, CPUs, SSDs, monitors and gaming PCs. Every part passes a 40-point inspection and comes with a 12-month warranty.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/deals" className="btn bg-brand-600 text-white hover:bg-brand-500">Shop Hot Deals</Link>
              <Link href="/category/graphics-cards" className="btn bg-white/10 text-white hover:bg-white/20">Browse GPUs</Link>
            </div>
            <div className="mt-8 flex items-center gap-2 text-sm text-slate-300">
              <span className="flex text-amber-400">{[1, 2, 3, 4, 5].map((i) => <StarIcon key={i} filled />)}</span>
              Trusted by gamers, creators & businesses across the UAE
            </div>
          </div>
          <div className="relative mx-auto aspect-square w-full max-w-md">
            <div className="absolute inset-0 rotate-6 rounded-[2rem] bg-brand-500/30" />
            <Image src="/img/gpu.svg" alt="Graphics card" fill priority className="rounded-[2rem] object-cover shadow-2xl" unoptimized />
          </div>
        </div>
      </section>

      <div className="container-x -mt-8 relative z-10"><TrustBar /></div>

      {/* Categories */}
      <section className="container-x mt-14">
        <div className="flex items-end justify-between">
          <h2 className="h-section">Shop by category</h2>
          <Link href="/search" className="text-sm font-semibold text-brand-700 hover:underline">All products →</Link>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {categories.map((c) => (
            <Link key={c.id} href={`/category/${c.slug}`} className="card group flex flex-col items-center p-3 text-center transition hover:border-brand-500 hover:shadow">
              <div className="relative aspect-square w-full"><Image src={`/img/${c.icon}.svg`} alt="" fill className="rounded-xl object-cover" unoptimized /></div>
              <p className="mt-2 text-xs font-semibold leading-tight md:text-sm">{c.name}</p>
              <p className="text-[11px] text-slate-500">{c._count.products} products</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section className="container-x mt-16">
        <div className="flex items-end justify-between">
          <h2 className="h-section">Best sellers</h2>
          <Link href="/search?sort=featured" className="text-sm font-semibold text-brand-700 hover:underline">See all →</Link>
        </div>
        <div className="mt-6"><ProductGrid products={featured.slice(0, 8)} /></div>
      </section>

      {/* Express banner */}
      <section className="container-x mt-16">
        <div className="card flex flex-col items-center justify-between gap-6 overflow-hidden bg-gradient-to-r from-amber-400 to-orange-500 p-8 text-ink-900 md:flex-row md:p-12">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold uppercase"><BoltIcon /> TechRevive Express</p>
            <h3 className="mt-2 text-3xl font-black">Order by 3 PM, get it tomorrow.</h3>
            <p className="mt-2 max-w-xl">Next-day delivery to all seven emirates on Express items, shipped from our Dubai warehouse.</p>
          </div>
          <Link href="/express" className="btn-dark shrink-0">Shop Express</Link>
        </div>
      </section>

      {/* Deals */}
      <section className="container-x mt-16">
        <div className="flex items-end justify-between">
          <h2 className="h-section">🔥 Biggest savings vs new</h2>
          <Link href="/deals" className="text-sm font-semibold text-brand-700 hover:underline">See all →</Link>
        </div>
        <div className="mt-6"><ProductGrid products={deals.slice(0, 4)} /></div>
      </section>

      <section className="container-x mt-16">
        <div className="flex items-end justify-between">
          <h2 className="h-section">Graphics cards</h2>
          <Link href="/category/graphics-cards" className="text-sm font-semibold text-brand-700 hover:underline">See all →</Link>
        </div>
        <div className="mt-6"><ProductGrid products={gpus} /></div>
      </section>

      {/* Why us */}
      <section className="container-x mt-16">
        <div className="card grid gap-10 p-8 md:grid-cols-2 md:p-12">
          <div>
            <h2 className="h-section">What is &quot;Certified Renewed&quot;?</h2>
            <p className="mt-4 text-slate-600">
              Renewed hardware is genuine, pre-owned or open-box equipment that our technicians in Dubai have inspected, cleaned, benchmarked and graded.
              You get the same performance for a fraction of the price, and keep e-waste out of landfill.
            </p>
            <Link href="/about#grading" className="btn-outline mt-6">How we grade</Link>
          </div>
          <ul className="space-y-4">
            {[
              ["40-point inspection", "Stress tests, thermals, benchmarks, SMART and MemTest checks on every part."],
              ["Never mining cards", "We screen sellers and reject ex-mining GPUs. Only 1 in 4 suppliers is accepted."],
              ["Honest grading", "Excellent, Very Good or Good. Cosmetic condition described with photos."],
              ["Local warranty & support", "A 12-month warranty handled from Dubai, with no shipping parts abroad."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-600 text-white"><CheckIcon className="h-4 w-4" /></span>
                <div><p className="font-semibold">{t}</p><p className="text-sm text-slate-600">{d}</p></div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

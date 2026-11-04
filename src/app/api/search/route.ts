import { NextResponse } from "next/server";
import { searchProducts, bestVariant } from "@/lib/catalog";
import { db } from "@/lib/db";

// Live search suggestions (header search box).
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ products: [], categories: [] });
  const [products, categories] = await Promise.all([
    searchProducts({ q }),
    db.category.findMany({ where: { OR: [{ name: { contains: q } }, { nameAr: { contains: q } }] }, take: 3 }),
  ]);
  return NextResponse.json({
    products: products.slice(0, 6).map((p) => {
      const b = bestVariant(p);
      return { slug: p.slug, name: p.name, nameAr: p.nameAr, brand: p.brand, image: p.image, price: b?.price ?? 0, priceNew: p.priceNew };
    }),
    categories: categories.map((c) => ({ slug: c.slug, name: c.name, nameAr: c.nameAr })),
    total: products.length,
  });
}

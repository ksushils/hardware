import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { siteUrl } from "@/lib/site";
import { visibleWhere } from "@/lib/catalog";

export const dynamic = "force-dynamic";

// Language is cookie-based; ?lang=ar is the Arabic alternate (middleware sets the cookie and redirects).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = siteUrl();
  const entry = (path: string, lastModified?: Date, priority = 0.6): MetadataRoute.Sitemap[number] => ({
    url: url + path, lastModified, priority, alternates: { languages: { en: url + path, ar: `${url}${path}${path.includes("?") ? "&" : "?"}lang=ar` } },
  });
  const [products, categories, collections, pages, articles, sellers] = await Promise.all([
    db.product.findMany({ where: visibleWhere, select: { slug: true, updatedAt: true } }),
    db.category.findMany({ select: { slug: true } }),
    db.collection.findMany({ where: { published: true }, select: { handle: true } }),
    db.page.findMany({ where: { published: true }, select: { handle: true, updatedAt: true } }),
    db.article.findMany({ where: { published: true, publishedAt: { lte: new Date() } }, select: { handle: true, updatedAt: true } }),
    db.seller.findMany({ where: { status: "APPROVED" }, select: { slug: true, updatedAt: true } }),
  ]);
  return [
    entry("/", new Date(), 1),
    ...["/deals", "/express", "/collections", "/blog", "/help", "/build", "/trade-in", "/sellers", "/become-a-seller"].map((p) => entry(p, undefined, 0.7)),
    ...categories.map((c) => entry(`/category/${c.slug}`, undefined, 0.8)),
    ...collections.map((c) => entry(`/collections/${c.handle}`, undefined, 0.7)),
    ...products.map((p) => entry(`/products/${p.slug}`, p.updatedAt, 0.9)),
    ...pages.map((p) => entry(`/pages/${p.handle}`, p.updatedAt, 0.4)),
    ...articles.map((a) => entry(`/blog/${a.handle}`, a.updatedAt, 0.6)),
    ...sellers.map((s) => entry(`/sellers/${s.slug}`, s.updatedAt, 0.5)),
  ];
}

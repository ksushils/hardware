import { db } from "@/lib/db";
import { siteUrl } from "@/lib/site";
import { getSettings } from "@/lib/settings";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function GET() {
  const [posts, s] = await Promise.all([db.article.findMany({ where: { published: true, publishedAt: { lte: new Date() } }, orderBy: { publishedAt: "desc" }, take: 50 }), getSettings()]);
  const url = siteUrl();
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(s.storeName)} Blog</title><link>${url}/blog</link><description>${esc(s.seo.description)}</description>
${posts.map((p) => `<item><title>${esc(p.title)}</title><link>${url}/blog/${p.handle}</link><guid>${url}/blog/${p.handle}</guid><pubDate>${p.publishedAt.toUTCString()}</pubDate><description>${esc(p.excerpt)}</description></item>`).join("\n")}
</channel></rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}

import { NextResponse, type NextRequest } from "next/server";

// Shopify-style URL redirects are loaded from /api/redirects (cached for 60s per server instance).
let cache: { at: number; map: Record<string, string> } = { at: 0, map: {} };
async function redirects(req: NextRequest) {
  if (Date.now() - cache.at < 60_000) return cache.map;
  try {
    const res = await fetch(new URL("/api/redirects", req.url), { headers: { "x-internal": "1" } });
    if (res.ok) cache = { at: Date.now(), map: await res.json() };
  } catch {}
  return cache.map;
}

export async function middleware(req: NextRequest) {
  // ?lang=ar or ?lang=en switches the storefront language (persisted in a cookie).
  const lang = req.nextUrl.searchParams.get("lang");
  if (lang === "ar" || lang === "en") {
    const url = req.nextUrl.clone();
    url.searchParams.delete("lang");
    const res = NextResponse.redirect(url);
    res.cookies.set("locale", lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    return res;
  }
  const path = req.nextUrl.pathname;
  if (!path.startsWith("/admin") && !path.startsWith("/seller/")) {
    const map = await redirects(req);
    const to = map[path] ?? map[path.replace(/\/$/, "")];
    if (to) {
      fetch(new URL(`/api/redirects?hit=${encodeURIComponent(path)}`, req.url), { method: "POST" }).catch(() => {});
      return NextResponse.redirect(new URL(to, req.url), 301);
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next|api|uploads|img|video|favicon|sitemap.xml|robots.txt).*)"] };

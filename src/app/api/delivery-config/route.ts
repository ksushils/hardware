import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";

// Public, non-sensitive: drives the "order within Xh" countdown on Express products.
export async function GET() {
  const s = await getSettings();
  return NextResponse.json(s.express, { headers: { "Cache-Control": "public, max-age=60" } });
}

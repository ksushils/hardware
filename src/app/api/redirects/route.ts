import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const rows = await db.redirect.findMany({ select: { fromPath: true, toPath: true } });
  return NextResponse.json(Object.fromEntries(rows.map((r) => [r.fromPath, r.toPath])));
}

export async function POST(req: Request) {
  const hit = new URL(req.url).searchParams.get("hit");
  if (hit) await db.redirect.updateMany({ where: { fromPath: hit }, data: { hits: { increment: 1 } } });
  return NextResponse.json({ ok: true });
}

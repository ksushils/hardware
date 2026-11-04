import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { escalateOverdueCases } from "@/lib/cases";

export const dynamic = "force-dynamic";

// Run every ~30 minutes, e.g. crontab:  */30 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/cases
function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // disabled until a secret is configured
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function run(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ escalated: await escalateOverdueCases() });
}
export const GET = run;
export const POST = run;

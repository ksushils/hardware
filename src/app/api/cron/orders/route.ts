import { NextResponse } from "next/server";
import { expireUnpaidCardOrders } from "@/lib/orderExpiry";

export const dynamic = "force-dynamic";

// Called by cron: curl -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3100/api/cron/orders
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(await expireUnpaidCardOrders(Number(process.env.UNPAID_ORDER_MINUTES) || 60));
}

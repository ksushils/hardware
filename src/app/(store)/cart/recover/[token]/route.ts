import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Abandoned checkout recovery link: restores the saved cart and sends the shopper to checkout.
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const c = await db.checkout.findUnique({ where: { token } });
  const url = new URL(c && !c.recoveredOrder ? "/cart?recovered=1" : "/cart", req.url);
  const res = NextResponse.redirect(url);
  if (c && !c.recoveredOrder) {
    res.cookies.set("tr_cart", c.items, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
    res.cookies.set("tr_checkout", c.token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  }
  return res;
}

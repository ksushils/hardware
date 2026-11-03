import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { markOrderPaid, stripe, stripeEnabled } from "@/lib/payments";
import { restock } from "@/lib/orders";

// Configure in Stripe Dashboard → Developers → Webhooks:
//   endpoint: https://your-domain/api/stripe/webhook
//   events: checkout.session.completed, checkout.session.expired
export async function POST(req: Request) {
  if (!stripeEnabled() || !process.env.STRIPE_WEBHOOK_SECRET) return NextResponse.json({ error: "Stripe not configured" }, { status: 400 });
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  let event;
  try {
    event = stripe().webhooks.constructEvent(body, sig!, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  if (event.type === "checkout.session.completed") {
    const s = event.data.object;
    if (s.metadata?.orderNumber && s.payment_status === "paid") await markOrderPaid(s.metadata.orderNumber, s.id);
  }
  if (event.type === "checkout.session.expired") {
    const number = event.data.object.metadata?.orderNumber;
    const order = number ? await db.order.findUnique({ where: { number } }) : null;
    if (order && order.paymentStatus !== "PAID" && order.status === "PENDING") {
      await db.order.update({ where: { number: order.number }, data: { status: "CANCELLED", paymentStatus: "FAILED" } });
      await restock(order.id);
    }
  }
  return NextResponse.json({ received: true });
}

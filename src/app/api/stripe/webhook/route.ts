import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe, stripeEnabled } from "@/lib/payments";
import { cancelOrderInternal, markOrderPaid } from "@/lib/orders";

// Stripe Dashboard → Developers → Webhooks: https://your-domain/api/stripe/webhook
// events: checkout.session.completed, checkout.session.expired
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
    if (s.metadata?.orderNumber && s.payment_status === "paid") await markOrderPaid(s.metadata.orderNumber, String(s.payment_intent ?? s.id));
  }
  if (event.type === "checkout.session.expired") {
    const number = event.data.object.metadata?.orderNumber;
    const order = number ? await db.order.findUnique({ where: { number } }) : null;
    if (order && order.paymentStatus !== "PAID" && order.status === "OPEN") {
      await db.order.update({ where: { id: order.id }, data: { paymentStatus: "FAILED" } });
      await cancelOrderInternal(order, "Card payment session expired");
    }
  }
  return NextResponse.json({ received: true });
}

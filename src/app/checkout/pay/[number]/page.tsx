import { notFound, redirect } from "next/navigation";
import { canViewOrder, getOrder } from "@/lib/orders";
import { stripeEnabled } from "@/lib/payments";
import { aed } from "@/lib/format";
import DemoCardForm from "./DemoCardForm";

export const metadata = { title: "Secure Payment" };

export default async function PayPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const order = await getOrder(number);
  if (!order || !(await canViewOrder(order))) notFound();
  if (order.paymentStatus === "PAID") redirect(`/order/${number}`);
  if (stripeEnabled()) redirect(`/order/${number}`);
  return (
    <div className="container-x max-w-lg py-12">
      <div className="card p-6">
        <p className="text-sm text-slate-500">Order {order.number}</p>
        <h1 className="text-2xl font-black">Pay {aed(order.total)}</h1>
        <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          <b>Demo payment gateway.</b> No real charge is made. Use card <span className="font-mono">4242 4242 4242 4242</span> with any future expiry and CVC.
          Card <span className="font-mono">4000 0000 0000 0002</span> simulates a decline. Set <span className="font-mono">STRIPE_SECRET_KEY</span> to take real payments.
        </div>
        <DemoCardForm number={order.number} total={aed(order.total)} />
      </div>
    </div>
  );
}

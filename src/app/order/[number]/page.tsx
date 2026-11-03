import Link from "next/link";
import { notFound } from "next/navigation";
import { canViewOrder, getOrder } from "@/lib/orders";
import { verifyStripeSession } from "@/lib/payments";
import OrderView from "@/components/OrderView";

export const metadata = { title: "Order details" };
export const dynamic = "force-dynamic";

export default async function OrderPage({ params, searchParams }: {
  params: Promise<{ number: string }>; searchParams: Promise<{ placed?: string; session_id?: string; cancelled?: string }>;
}) {
  const { number } = await params;
  const sp = await searchParams;
  let order = await getOrder(number);
  if (!order || !(await canViewOrder(order))) notFound();
  if (sp.session_id && order.paymentStatus !== "PAID") {
    await verifyStripeSession(number, sp.session_id).catch(() => null);
    order = (await getOrder(number))!;
  }
  const success = (sp.placed || sp.session_id) && (order.paymentStatus === "PAID" || order.paymentMethod === "COD");

  return (
    <div className="container-x max-w-5xl py-10">
      {success && (
        <div className="mb-6 rounded-2xl bg-brand-600 p-6 text-white">
          <p className="text-2xl font-black">🎉 Thank you, {order.fullName.split(" ")[0]}! Your order is confirmed.</p>
          <p className="mt-1 text-brand-50">We&apos;ve sent confirmation to {order.email}. You can track your order anytime.</p>
        </div>
      )}
      {sp.cancelled && order.paymentStatus !== "PAID" && (
        <div className="mb-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Payment was cancelled. Your order is saved. Complete payment below or choose another method.</div>
      )}
      <OrderView order={order} />
      <div className="mt-6 flex gap-3">
        <Link href="/" className="btn-outline">Continue shopping</Link>
        <Link href="/account/orders" className="btn-dark">My orders</Link>
      </div>
    </div>
  );
}

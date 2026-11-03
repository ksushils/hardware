import { db } from "@/lib/db";
import OrderView from "@/components/OrderView";

export const metadata = { title: "Track Your Order" };

export default async function TrackPage({ searchParams }: { searchParams: Promise<{ number?: string; email?: string }> }) {
  const { number, email } = await searchParams;
  const order = number && email
    ? await db.order.findFirst({ where: { number: number.trim().toUpperCase(), email: email.trim().toLowerCase() }, include: { items: true } })
    : null;
  return (
    <div className="container-x max-w-5xl py-10">
      <h1 className="text-3xl font-black">Track your order</h1>
      <form className="card mt-6 grid gap-3 p-5 sm:grid-cols-[1fr_1fr_auto]">
        <input name="number" required defaultValue={number} placeholder="Order number (e.g. TR251103-ABCDE)" className="input" />
        <input name="email" type="email" required defaultValue={email} placeholder="Email used at checkout" className="input" />
        <button className="btn-primary">Track</button>
      </form>
      {number && email && !order && <p className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">No order found with those details.</p>}
      {order && <div className="mt-6"><OrderView order={order} actions={false} /></div>}
    </div>
  );
}

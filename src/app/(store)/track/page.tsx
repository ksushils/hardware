import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n";
import OrderView from "@/components/OrderView";

export const metadata = { title: "Track Your Order" };

export default async function TrackPage({ searchParams }: { searchParams: Promise<{ number?: string; email?: string }> }) {
  const { number, email } = await searchParams;
  const { t } = await getI18n();
  const order = number && email ? await db.order.findFirst({ where: { number: number.trim().toUpperCase(), email: email.trim().toLowerCase(), status: { not: "DRAFT" } }, include: { items: true, returns: true } }) : null;
  return (
    <div className="container-x max-w-5xl py-10">
      <h1 className="text-3xl font-black">{t.track.title}</h1>
      <form className="card mt-6 grid gap-3 p-5 sm:grid-cols-[1fr_1fr_auto]">
        <input name="number" required defaultValue={number} placeholder={t.track.numberPh} aria-label={t.track.numberPh} className="input" dir="ltr" />
        <input name="email" type="email" required defaultValue={email} placeholder={t.track.emailPh} aria-label={t.track.emailPh} className="input" />
        <button className="btn-primary">{t.track.track}</button>
      </form>
      {number && email && !order && <p className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">{t.track.notFound}</p>}
      {order && <div className="mt-6"><OrderView order={order} actions={false} /></div>}
    </div>
  );
}

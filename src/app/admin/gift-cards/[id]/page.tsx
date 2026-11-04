import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { Card, PageHeader, td, th } from "@/components/admin/ui";
import { ConfirmButton, CopyButton } from "@/components/admin/client";
import { EditGiftCardForm } from "@/components/admin/products/GiftCardForms";
import { deleteGiftCard, resendGiftCard } from "@/app/actions/admin/giftcards";

export const metadata = { title: "Gift card" };

export default async function GiftCardDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  await requirePermission("products");
  const { id } = await params;
  const { created } = await searchParams;
  const card = await db.giftCard.findUnique({ where: { id } });
  if (!card) notFound();
  const orders = await db.order.findMany({ where: { giftCardCode: card.code }, orderBy: { createdAt: "desc" }, select: { number: true, giftCardAmount: true, createdAt: true, status: true } });
  return (
    <>
      <PageHeader
        title={<span className="font-mono">•••• {card.code.slice(-4)}</span>} back="/admin/gift-cards" subtitle={`Issued ${card.createdAt.toLocaleDateString("en-AE")}`}
        actions={<>
          {card.customerEmail && <form action={resendGiftCard}><input type="hidden" name="id" value={card.id} /><button className="btn-a">Resend email</button></form>}
          <form action={deleteGiftCard}><input type="hidden" name="id" value={card.id} /><ConfirmButton message="Delete this gift card? Its remaining balance will be lost.">Delete</ConfirmButton></form>
        </>}
      />
      {created && <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">Gift card issued. Copy the full code now. It is masked everywhere else.</div>}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card title="Details"><EditGiftCardForm card={{ id: card.id, balance: card.balance, customerEmail: card.customerEmail, note: card.note, expiresAt: card.expiresAt ? card.expiresAt.toISOString().slice(0, 10) : "", active: card.active }} /></Card>
        <div className="space-y-4">
          <Card title="Gift card code">
            <p className="break-all rounded-lg bg-slate-900 px-3 py-3 text-center font-mono text-lg tracking-wider text-white">{card.code}</p>
            <div className="mt-2"><CopyButton text={card.code} label="Copy code" /></div>
            <p className="mt-3 text-sm text-slate-600">Balance <b>AED {card.balance.toLocaleString()}</b> of AED {card.initialValue.toLocaleString()}</p>
          </Card>
          <Card title="Used on orders" pad={false}>
            {orders.length ? (
              <table className="w-full text-sm"><thead className="border-b bg-slate-50"><tr><th className={th}>Order</th><th className={th}>Amount</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{orders.map((o) => <tr key={o.number}><td className={td}><a className="font-semibold hover:underline" href={`/admin/orders/${o.number}`}>{o.number}</a><p className="text-xs text-slate-500">{o.createdAt.toLocaleDateString("en-AE")} · {o.status.toLowerCase()}</p></td><td className={td}>AED {o.giftCardAmount}</td></tr>)}</tbody></table>
            ) : <p className="p-4 text-sm text-slate-500">Not used yet.</p>}
          </Card>
        </div>
      </div>
    </>
  );
}

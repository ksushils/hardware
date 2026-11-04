import { db } from "@/lib/db";
import { requireSeller } from "@/lib/sellerAuth";
import { Card, PageHeader, EmptyState, Badge } from "@/components/admin/ui";
import ReplyForm from "@/components/marketplace/ReplyForm";
import { markMessageRead } from "@/app/actions/seller";

export const metadata = { title: "Messages" };

export default async function SellerMessages() {
  const { seller } = await requireSeller();
  const messages = await db.sellerMessage.findMany({ where: { sellerId: seller.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const products = await db.product.findMany({ where: { id: { in: messages.map((m) => m.productId).filter((x): x is string => !!x) } }, select: { id: true, name: true } });
  return (
    <>
      <PageHeader title="Messages" subtitle="Questions from customers. Reply within 24 hours to keep a good rating." />
      <Card pad={false}>
        {messages.length ? (
          <div className="divide-y divide-slate-100">
            {messages.map((m) => (
              <details key={m.id} className="p-4 text-sm" open={!m.readAt}>
                <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                  {!m.readAt && <Badge tone="purple">New</Badge>}{m.reply && <Badge tone="green">Replied</Badge>}
                  <b>{m.subject}</b><span className="text-slate-500">from {m.fromName} · {m.createdAt.toLocaleString("en-AE")}</span>
                </summary>
                {m.productId && <p className="mt-2 text-xs text-slate-500">About: {products.find((p) => p.id === m.productId)?.name}</p>}
                <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3">{m.body}</p>
                {m.reply && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-violet-50 p-3"><b>Your reply:</b> {m.reply}</p>}
                <ReplyForm id={m.id} />
                {!m.readAt && <form action={markMessageRead} className="mt-1"><input type="hidden" name="id" value={m.id} /><button className="text-xs text-slate-500 underline">Mark as read</button></form>}
              </details>
            ))}
          </div>
        ) : <EmptyState title="No messages yet" />}
      </Card>
    </>
  );
}

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSeller } from "@/lib/sellerAuth";
import { PrintButton } from "@/components/admin/client";

export const metadata = { title: "Packing slip" };

export default async function SellerPackingSlip({ params }: { params: Promise<{ id: string }> }) {
  const { seller } = await requireSeller();
  const { id } = await params;
  const so = await db.sellerOrder.findFirst({ where: { id, sellerId: seller.id }, include: { order: true, items: true } });
  if (!so) notFound();
  const o = so.order;
  return (
    <div className="mx-auto max-w-2xl bg-white p-8 text-sm shadow print:shadow-none">
      <div className="mb-6 flex items-start justify-between">
        <div><p className="text-2xl font-bold">Packing slip</p><p>Order {o.number} · {o.createdAt.toLocaleDateString("en-AE")}</p></div>
        <div className="text-end"><p className="font-bold">{seller.shopName}</p><p>{seller.address}, {seller.emirate}</p><p>Sold via TechRevive Marketplace</p><PrintButton /></div>
      </div>
      <p className="font-semibold">Ship to</p>
      <p className="mb-6">{o.fullName}<br />{o.building}, {o.street}<br />{o.area}, {o.emirate}<br />{o.phone}</p>
      <table className="w-full border-collapse">
        <thead><tr className="border-b-2"><th className="py-2 text-start">Item</th><th className="py-2 text-start">SKU</th><th className="py-2 text-end">Qty</th></tr></thead>
        <tbody>{so.items.map((i) => <tr key={i.id} className="border-b"><td className="py-2">{i.name}{i.variantTitle ? ` — ${i.variantTitle}` : ""}</td><td className="py-2">{i.sku ?? ""}</td><td className="py-2 text-end">{i.quantity}</td></tr>)}</tbody>
      </table>
      {o.customerNote && <p className="mt-4">Customer note: {o.customerNote}</p>}
      <p className="mt-8 text-xs text-slate-500">Questions about this order? Contact {seller.email} · {seller.phone}</p>
    </div>
  );
}

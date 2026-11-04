import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { getOrder } from "@/lib/orders";
import { getSettings } from "@/lib/settings";
import { PrintButton } from "@/components/admin/client";

export const metadata = { title: "Tax invoice" };
const f = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function Invoice({ params }: { params: Promise<{ number: string }> }) {
  await requirePermission("orders");
  const { number } = await params;
  const [order, s] = await Promise.all([getOrder(number), getSettings()]);
  if (!order) notFound();
  const r = s.tax.rate / 100;
  const lines = order.items.map((i) => {
    const gross = (i.price + i.warrantyPrice) * i.quantity;
    const net = gross / (1 + r);
    return { ...i, unitNet: (i.price + i.warrantyPrice) / (1 + r), net, vat: gross - net, gross };
  });
  const extras = [
    order.shipping > 0 ? { label: `Shipping (${order.shippingRateName})`, gross: order.shipping } : null,
    order.codFee > 0 ? { label: "Cash on delivery fee", gross: order.codFee } : null,
    order.discount > 0 ? { label: `Discount${order.discountCode ? ` (${order.discountCode})` : ""}`, gross: -order.discount } : null,
  ].filter((x): x is { label: string; gross: number } => !!x);
  const grossTotal = lines.reduce((a, l) => a + l.gross, 0) + extras.reduce((a, e) => a + e.gross, 0);
  const netTotal = grossTotal / (1 + r);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex justify-end gap-2 print:hidden"><PrintButton /></div>
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm print:border-0 print:p-0">
        <div className="flex justify-between gap-6">
          <div>
            <p className="text-2xl font-black">{s.storeName}</p>
            <p className="mt-1 text-slate-600">{s.legalName}<br />{s.address}<br />{s.email} · {s.phone}</p>
            <p className="mt-1 font-semibold">TRN: {s.trn || <span className="text-red-600 print:text-slate-400">Not set (Settings → General)</span>}</p>
          </div>
          <div className="text-end">
            <p className="text-xl font-bold">TAX INVOICE</p>
            <p dir="rtl" className="text-lg font-bold">فاتورة ضريبية</p>
            <p className="mt-2">Invoice no: <b>{order.number}</b></p>
            <p>Date: {(order.paidAt ?? order.createdAt).toLocaleDateString("en-AE", { dateStyle: "long" })}</p>
            <p>Payment: {order.paymentMethod} · {order.paymentStatus.replace(/_/g, " ")}</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-6 rounded-lg bg-slate-50 p-4">
          <div><p className="text-xs font-semibold uppercase text-slate-500">Bill to</p><p>{order.fullName}<br />{order.email}<br />{order.phone}</p></div>
          <div><p className="text-xs font-semibold uppercase text-slate-500">Ship to</p><p>{order.building}, {order.street}<br />{order.area}, {order.emirate}<br />United Arab Emirates</p></div>
        </div>
        <table className="mt-6 w-full">
          <thead><tr className="border-b-2 border-slate-900 text-xs uppercase text-slate-600">
            <th className="py-2 text-start">Description</th><th className="text-end">Qty</th><th className="text-end">Unit (excl. VAT)</th><th className="text-end">Net</th><th className="text-end">VAT {s.tax.rate}%</th><th className="text-end">Total</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((l) => (
              <tr key={l.id}>
                <td className="py-2">{l.name}{l.variantTitle && <span className="text-slate-500"> ({l.variantTitle})</span>}{l.warranty && <span className="block text-xs text-slate-500">incl. Care+ extended warranty</span>}{l.sku && <span className="block text-xs text-slate-400">SKU {l.sku}</span>}</td>
                <td className="text-end">{l.quantity}</td><td className="text-end">{f(l.unitNet)}</td><td className="text-end">{f(l.net)}</td><td className="text-end">{f(l.vat)}</td><td className="text-end">{f(l.gross)}</td>
              </tr>
            ))}
            {extras.map((e) => (
              <tr key={e.label}><td className="py-2" colSpan={3}>{e.label}</td><td className="text-end">{f(e.gross / (1 + r))}</td><td className="text-end">{f(e.gross - e.gross / (1 + r))}</td><td className="text-end">{f(e.gross)}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="ms-auto mt-4 w-72 space-y-1">
          <div className="flex justify-between"><span>Total excl. VAT</span><span>AED {f(netTotal)}</span></div>
          <div className="flex justify-between"><span>VAT ({s.tax.rate}%)</span><span>AED {f(grossTotal - netTotal)}</span></div>
          <div className="flex justify-between border-t border-slate-900 pt-1 font-bold"><span>Total incl. VAT</span><span>AED {f(grossTotal)}</span></div>
          {order.giftCardAmount > 0 && <div className="flex justify-between"><span>Paid by gift card</span><span>− AED {f(order.giftCardAmount)}</span></div>}
          {order.refundedAmount > 0 && <div className="flex justify-between"><span>Refunded</span><span>− AED {f(order.refundedAmount)}</span></div>}
          <div className="flex justify-between font-semibold"><span>{order.paymentStatus === "PENDING" ? "Amount due" : "Amount paid"}</span><span>AED {f(order.total - order.refundedAmount)}</span></div>
        </div>
        <p className="mt-10 text-center text-xs text-slate-500">Thank you for shopping with {s.storeName}. All amounts in UAE Dirhams (AED).</p>
      </div>
    </div>
  );
}

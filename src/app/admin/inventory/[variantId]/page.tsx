import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { Badge, Card, EmptyState, PageHeader, td, th } from "@/components/admin/ui";

export const metadata = { title: "Inventory history" };

export default async function VariantHistory({ params }: { params: Promise<{ variantId: string }> }) {
  await requirePermission("products");
  const { variantId } = await params;
  const v = await db.variant.findUnique({ where: { id: variantId }, include: { product: true, adjustments: { orderBy: { createdAt: "desc" }, take: 200 } } });
  if (!v) notFound();
  const userIds = [...new Set(v.adjustments.map((a) => a.userId).filter((x): x is string => !!x))];
  const users = await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });
  let running = v.stock;
  const rows = v.adjustments.map((a) => { const after = running; running -= a.delta; return { a, after }; });
  return (
    <>
      <PageHeader title={`${v.product.name}: ${v.title}`} back="/admin/inventory" subtitle={`SKU ${v.sku ?? "-"} · ${v.stock} available`} actions={<Link href={`/admin/products/${v.productId}`} className="btn-a">Edit product</Link>} />
      <Card title="Adjustment history" pad={false}>
        {rows.length ? (
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50"><tr><th className={th}>Date</th><th className={th}>Reason</th><th className={th}>Change</th><th className={th}>After</th><th className={th}>By</th><th className={th}>Note</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(({ a, after }) => (
                <tr key={a.id}>
                  <td className={td}>{a.createdAt.toLocaleString("en-AE")}</td>
                  <td className={td}><Badge tone={a.reason === "sold" ? "blue" : a.reason === "damaged" ? "red" : a.reason === "received" ? "green" : "gray"}>{a.reason}</Badge></td>
                  <td className={`${td} font-semibold ${a.delta > 0 ? "text-emerald-700" : "text-red-600"}`}>{a.delta > 0 ? "+" : ""}{a.delta}</td>
                  <td className={td}>{after}</td>
                  <td className={td}>{users.find((u) => u.id === a.userId)?.name ?? "System"}</td>
                  <td className={`${td} text-slate-500`}>{a.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState title="No adjustments recorded yet" />}
      </Card>
    </>
  );
}

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { Card, EmptyState, PageHeader, Pagination, Stat, Tabs } from "@/components/admin/ui";
import InventoryRow from "@/components/admin/products/InventoryRow";

export const metadata = { title: "Inventory" };
const PAGE_SIZE = 50;

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; page?: string }> }) {
  await requirePermission("products");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const filter = sp.filter ?? "all";
  const where: Prisma.VariantWhereInput = {};
  if (filter === "low") where.AND = [{ trackInventory: true }, { stock: { gt: 0, lte: 3 } }];
  if (filter === "out") where.AND = [{ trackInventory: true }, { stock: { lte: 0 } }];
  if (filter === "untracked") where.trackInventory = false;
  if (sp.q) where.OR = [{ sku: { contains: sp.q } }, { title: { contains: sp.q } }, { barcode: { contains: sp.q } }, { product: { name: { contains: sp.q } } }, { product: { brand: { contains: sp.q } } }];

  const [total, variants, agg, lowCount, outCount, committed] = await Promise.all([
    db.variant.count({ where }),
    db.variant.findMany({ where, include: { product: { select: { id: true, name: true, image: true } } }, orderBy: [{ product: { name: "asc" } }, { position: "asc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.variant.findMany({ where: { trackInventory: true }, select: { stock: true, cost: true, price: true } }),
    db.variant.count({ where: { trackInventory: true, stock: { gt: 0, lte: 3 } } }),
    db.variant.count({ where: { trackInventory: true, stock: { lte: 0 } } }),
    db.orderItem.groupBy({ by: ["variantId"], _sum: { quantity: true }, where: { order: { status: "OPEN", fulfillmentStatus: "UNFULFILLED" } } }),
  ]);
  const units = agg.reduce((s, v) => s + Math.max(0, v.stock), 0);
  const value = agg.reduce((s, v) => s + Math.max(0, v.stock) * (v.cost ?? 0), 0);
  const retail = agg.reduce((s, v) => s + Math.max(0, v.stock) * v.price, 0);
  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/admin/inventory${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Inventory" subtitle="Committed = units in open, unfulfilled orders (already deducted from available)." />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Units in stock" value={units.toLocaleString()} />
        <Stat label="Inventory value (cost)" value={`AED ${Math.round(value).toLocaleString()}`} sub={`Retail value AED ${Math.round(retail).toLocaleString()}`} />
        <Stat label="Low stock variants" value={lowCount} />
        <Stat label="Out of stock variants" value={outCount} />
      </div>
      <Card pad={false}>
        <Tabs current={filter} tabs={[
          { key: "all", label: "All", href: href({ filter: "", page: "" }) },
          { key: "low", label: "Low stock", href: href({ filter: "low", page: "" }), count: lowCount },
          { key: "out", label: "Out of stock", href: href({ filter: "out", page: "" }), count: outCount },
          { key: "untracked", label: "Not tracked", href: href({ filter: "untracked", page: "" }) },
        ]} />
        <form className="border-b border-slate-100 p-3">
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
          <input name="q" defaultValue={sp.q} placeholder="Search product, variant, SKU or barcode" className="in-a max-w-md" />
        </form>
        {variants.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                <tr><th className="px-4 py-2.5 text-start">Product</th><th className="px-3 py-2.5 text-start">SKU</th><th className="px-3 py-2.5 text-start">Committed</th><th className="px-3 py-2.5 text-start">Available</th><th className="px-3 py-2.5 text-start">Update quantity</th><th /></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {variants.map((v) => (
                  <InventoryRow key={v.id} r={{
                    id: v.id, productId: v.product.id, product: v.product.name, title: v.title, sku: v.sku ?? "", image: v.image || v.product.image,
                    stock: v.stock, tracked: v.trackInventory, oversell: v.continueSelling, committed: committed.find((c) => c.variantId === v.id)?._sum.quantity ?? 0,
                  }} />
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="No variants match" />}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} makeHref={(p) => href({ page: String(p) })} />
      </Card>
    </>
  );
}

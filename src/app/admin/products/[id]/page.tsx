import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { matchRule, parseRules } from "@/lib/collections";
import { productInclude } from "@/lib/catalog";
import { PageHeader, StatusBadge } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/client";
import ProductEditor from "@/components/admin/products/ProductEditor";
import { deleteProduct, duplicateProduct } from "@/app/actions/admin/products";
import { editorLookups, loadProductInput, storeHost } from "../_data";

export const metadata = { title: "Edit product" };

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; duplicated?: string }> }) {
  await requirePermission("products");
  const { id } = await params;
  const sp = await searchParams;
  const data = await loadProductInput(id);
  if (!data) notFound();
  const { product, input } = data;
  const { categories, collections } = await editorLookups();

  // smart collections this product currently matches
  const [smart, full, sold, adjacent] = await Promise.all([
    db.collection.findMany({ where: { type: "SMART" } }),
    db.product.findUnique({ where: { id }, include: productInclude }),
    db.orderItem.aggregate({ _sum: { quantity: true }, where: { productId: id, order: { status: { not: "CANCELLED" } } } }),
    Promise.all([
      db.product.findFirst({ where: { createdAt: { lt: product.createdAt } }, orderBy: { createdAt: "desc" }, select: { id: true } }),
      db.product.findFirst({ where: { createdAt: { gt: product.createdAt } }, orderBy: { createdAt: "asc" }, select: { id: true } }),
    ]),
  ]);
  const smartTitles = full ? smart.filter((c) => { const r = parseRules(c.rules); return r.length && (c.disjunctive ? r.some((x) => matchRule(full, x)) : r.every((x) => matchRule(full, x))); }).map((c) => c.title) : [];

  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-2">{product.name} <StatusBadge status={product.status} /></span>}
        back="/admin/products"
        subtitle={`${sold._sum.quantity ?? 0} sold · created ${product.createdAt.toLocaleDateString("en-AE")} · updated ${product.updatedAt.toLocaleString("en-AE")}`}
        actions={
          <>
            {adjacent[0] && <Link className="btn-a" href={`/admin/products/${adjacent[0].id}`} title="Previous product">‹</Link>}
            {adjacent[1] && <Link className="btn-a" href={`/admin/products/${adjacent[1].id}`} title="Next product">›</Link>}
            <Link className="btn-a" href={`/products/${product.slug}`} target="_blank">View ↗</Link>
            <form action={duplicateProduct}><input type="hidden" name="id" value={product.id} /><button className="btn-a">Duplicate</button></form>
            <form action={deleteProduct}><input type="hidden" name="id" value={product.id} /><ConfirmButton message={`Delete "${product.name}"? This cannot be undone.`}>Delete</ConfirmButton></form>
          </>
        }
      />
      {sp.saved && <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">Product saved.</div>}
      {sp.duplicated && <div className="mb-4 rounded-lg bg-sky-50 px-4 py-2.5 text-sm text-sky-800">Product duplicated as a draft. SKUs and stock were cleared.</div>}
      <ProductEditor key={product.updatedAt.toISOString()} initial={input} categories={categories} collections={collections} smartCollections={smartTitles} storeHost={storeHost()} />
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { parseRules, RULE_FIELDS, RULE_OPS } from "@/lib/collections";
import { PageHeader } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/client";
import CollectionEditor from "@/components/admin/products/CollectionEditor";
import { deleteCollection } from "@/app/actions/admin/collections";
import { pickerProducts } from "../_data";

export const metadata = { title: "Edit collection" };

export default async function EditCollection({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  await requirePermission("products");
  const { id } = await params;
  const { saved } = await searchParams;
  const c = await db.collection.findUnique({ where: { id }, include: { products: { orderBy: { position: "asc" } } } });
  if (!c) notFound();
  return (
    <>
      <PageHeader
        title={c.title} back="/admin/collections"
        actions={<>
          <Link className="btn-a" href={`/collections/${c.handle}`} target="_blank">View ↗</Link>
          <form action={deleteCollection}><input type="hidden" name="id" value={c.id} /><ConfirmButton message={`Delete collection "${c.title}"? Products are not deleted.`}>Delete</ConfirmButton></form>
        </>}
      />
      {saved && <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">Collection saved.</div>}
      <CollectionEditor
        key={c.id + c.title + c.products.length} products={await pickerProducts()} fields={RULE_FIELDS} ops={RULE_OPS}
        initial={{
          id: c.id, title: c.title, titleAr: c.titleAr, description: c.description, descriptionAr: c.descriptionAr, handle: c.handle, image: c.image ?? "",
          type: c.type === "SMART" ? "SMART" : "MANUAL", rules: parseRules(c.rules), disjunctive: c.disjunctive, sortOrder: c.sortOrder, published: c.published, showOnHome: c.showOnHome,
          seoTitle: c.seoTitle ?? "", seoDescription: c.seoDescription ?? "", productIds: c.products.map((p) => p.productId),
        }}
      />
    </>
  );
}

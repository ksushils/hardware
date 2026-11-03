import Link from "next/link";
import { db } from "@/lib/db";
import { aed } from "@/lib/format";
import { deleteProduct } from "@/app/actions/admin";

export default async function AdminProducts({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const products = await db.product.findMany({
    where: q ? { OR: [{ name: { contains: q } }, { brand: { contains: q } }] } : {},
    include: { variants: true, category: true }, orderBy: { createdAt: "desc" },
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between gap-3">
        <form><input name="q" defaultValue={q} placeholder="Search products..." className="input w-72 py-2" /></form>
        <Link href="/admin/products/new" className="btn-primary">+ New product</Link>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="p-3">Product</th><th>Category</th><th>From</th><th>Stock</th><th>Status</th><th></th></tr></thead>
          <tbody className="divide-y">
            {products.map((p) => {
              const stock = p.variants.reduce((s, v) => s + v.stock, 0);
              const min = Math.min(...p.variants.map((v) => v.price));
              return (
                <tr key={p.id}>
                  <td className="p-3"><p className="font-semibold">{p.name}</p><p className="text-xs text-slate-500">{p.brand}</p></td>
                  <td>{p.category.name}</td>
                  <td>{p.variants.length ? aed(min) : "–"}</td>
                  <td className={stock === 0 ? "font-bold text-red-600" : ""}>{stock}</td>
                  <td>{p.active ? <span className="text-brand-700">Active</span> : <span className="text-slate-400">Hidden</span>}{p.featured && " · ⭐"}{p.express && " · ⚡"}</td>
                  <td className="whitespace-nowrap pr-3 text-right">
                    <Link href={`/admin/products/${p.id}`} className="mr-3 font-semibold text-brand-700">Edit</Link>
                    <form action={deleteProduct} className="inline"><input type="hidden" name="id" value={p.id} /><button className="text-red-600">Delete</button></form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

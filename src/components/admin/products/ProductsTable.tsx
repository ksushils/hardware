"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { bulkProducts } from "@/app/actions/admin/products";

export type ProductRow = {
  id: string; name: string; image: string; status: string; brand: string; category: string; type: string;
  stock: number; variants: number; tracked: boolean; low: boolean; priceFrom: number; priceTo: number;
  seller?: string | null; approval?: string;
};

const statusCls: Record<string, string> = { ACTIVE: "bg-emerald-100 text-emerald-800", DRAFT: "bg-sky-100 text-sky-800", ARCHIVED: "bg-slate-200 text-slate-700" };

export default function ProductsTable({ rows }: { rows: ProductRow[] }) {
  const [sel, setSel] = useState<string[]>([]);
  const [tag, setTag] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const all = rows.length > 0 && sel.length === rows.length;

  const run = (action: string, value = "") => {
    if (action === "delete" && !confirm(`Delete ${sel.length} product(s)? This cannot be undone.`)) return;
    start(async () => {
      const r = await bulkProducts(sel, action, value);
      setMsg(r.error ?? `Updated ${r.count} product(s).`);
      if (r.ok) { setSel([]); setTag(""); router.refresh(); }
    });
  };

  return (
    <div>
      {sel.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm">
          <span className="font-semibold">{sel.length} selected</span>
          <button className="btn-a" disabled={pending} onClick={() => run("ACTIVE")}>Set active</button>
          <button className="btn-a" disabled={pending} onClick={() => run("DRAFT")}>Set draft</button>
          <button className="btn-a" disabled={pending} onClick={() => run("ARCHIVED")}>Archive</button>
          <button className="btn-a" disabled={pending} onClick={() => run("feature")}>Feature</button>
          <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Tag" className="in-a w-28 py-1" />
          <button className="btn-a" disabled={pending || !tag} onClick={() => run("addTag", tag)}>Add tag</button>
          <button className="btn-a" disabled={pending || !tag} onClick={() => run("removeTag", tag)}>Remove tag</button>
          <a className="btn-a" href={`/api/admin/products/export?format=xlsx&ids=${sel.join(",")}`}>Export</a>
          <button className="btn-a-danger" disabled={pending} onClick={() => run("delete")}>Delete</button>
        </div>
      )}
      {msg && <p className="border-b border-slate-100 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{msg}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="w-10 px-4 py-2.5"><input type="checkbox" checked={all} onChange={() => setSel(all ? [] : rows.map((r) => r.id))} aria-label="Select all" /></th>
              <th className="px-2 py-2.5 text-start text-xs font-semibold uppercase text-slate-500">Product</th>
              <th className="px-4 py-2.5 text-start text-xs font-semibold uppercase text-slate-500">Status</th>
              <th className="px-4 py-2.5 text-start text-xs font-semibold uppercase text-slate-500">Inventory</th>
              <th className="px-4 py-2.5 text-start text-xs font-semibold uppercase text-slate-500">Price</th>
              <th className="px-4 py-2.5 text-start text-xs font-semibold uppercase text-slate-500">Category</th>
              <th className="px-4 py-2.5 text-start text-xs font-semibold uppercase text-slate-500">Vendor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className={`hover:bg-slate-50 ${sel.includes(r.id) ? "bg-slate-50" : ""}`}>
                <td className="px-4 py-2"><input type="checkbox" checked={sel.includes(r.id)} onChange={() => setSel((s) => (s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id]))} aria-label={`Select ${r.name}`} /></td>
                <td className="px-2 py-2">
                  <Link href={`/admin/products/${r.id}`} className="flex items-center gap-3">
                    <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      {r.image ? <img src={r.image} alt="" className="h-full w-full object-contain" /> : null}
                    </span>
                    <span className="font-semibold text-slate-900 hover:underline">{r.name}</span>
                  </Link>
                </td>
                <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusCls[r.status] ?? ""}`}>{r.status.charAt(0) + r.status.slice(1).toLowerCase()}</span>
                  {r.approval && r.approval !== "APPROVED" && <span className={`ms-1 rounded-full px-2 py-0.5 text-xs font-semibold ${r.approval === "REJECTED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{r.approval === "PENDING" ? "Awaiting approval" : r.approval.charAt(0) + r.approval.slice(1).toLowerCase()}</span>}</td>
                <td className="px-4 py-2">
                  {r.tracked ? (
                    <span className={r.stock <= 0 ? "font-semibold text-red-600" : r.low ? "text-amber-600" : "text-slate-700"}>
                      {r.stock} in stock{r.variants > 1 ? ` for ${r.variants} variants` : ""}
                    </span>
                  ) : <span className="text-slate-500">Not tracked</span>}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">AED {r.priceFrom.toLocaleString()}{r.priceTo > r.priceFrom ? ` – ${r.priceTo.toLocaleString()}` : ""}</td>
                <td className="px-4 py-2 text-slate-600">{r.category}</td>
                <td className="px-4 py-2 text-slate-600">{r.brand}{r.seller && <span className="block text-xs text-violet-700">🏪 {r.seller}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { adjustInventory } from "@/app/actions/admin/inventory";

export type InvRow = { id: string; productId: string; product: string; title: string; sku: string; image: string; stock: number; tracked: boolean; oversell: boolean; committed: number };

export default function InventoryRow({ r }: { r: InvRow }) {
  const [stock, setStock] = useState(r.stock);
  const [mode, setMode] = useState<"adjust" | "set">("adjust");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("correction");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    const res = await adjustInventory(r.id, mode, Number(value), reason);
    if ("error" in res && res.error) setMsg(res.error);
    else if ("stock" in res && res.stock != null) { setStock(res.stock); setValue(""); setMsg("Saved"); setTimeout(() => setMsg(null), 1500); }
  });
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-2">
        <div className="flex items-center gap-3">
          <img src={r.image} alt="" className="h-9 w-9 rounded border border-slate-200 object-contain" />
          <div><Link href={`/admin/products/${r.productId}`} className="font-semibold hover:underline">{r.product}</Link><p className="text-xs text-slate-500">{r.title}</p></div>
        </div>
      </td>
      <td className="px-3 py-2 text-slate-600">{r.sku || "-"}</td>
      <td className="px-3 py-2 text-slate-600">{r.committed}</td>
      <td className="px-3 py-2">
        {r.tracked ? <span className={`font-semibold ${stock <= 0 ? "text-red-600" : stock <= 3 ? "text-amber-600" : ""}`}>{stock}</span> : <span className="text-slate-400">Not tracked</span>}
        {r.oversell && <span className="ms-1 text-[11px] text-slate-500">(oversell on)</span>}
      </td>
      <td className="px-3 py-2">
        {r.tracked ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <select className="rounded border border-slate-300 px-1.5 py-1 text-xs" value={mode} onChange={(e) => setMode(e.target.value as "adjust" | "set")}>
              <option value="adjust">Adjust by</option><option value="set">Set to</option>
            </select>
            <input type="number" className="w-20 rounded border border-slate-300 px-2 py-1 text-sm" value={value} onChange={(e) => setValue(e.target.value)} placeholder={mode === "adjust" ? "+/-" : String(stock)}
              onKeyDown={(e) => { if (e.key === "Enter" && value !== "") save(); }} />
            <select className="rounded border border-slate-300 px-1.5 py-1 text-xs" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="received">Received</option><option value="correction">Correction</option><option value="damaged">Damaged</option><option value="returned">Returned</option><option value="other">Other</option>
            </select>
            <button className="btn-a py-1" disabled={pending || value === ""} onClick={save}>{pending ? "…" : "Save"}</button>
            {msg && <span className={`text-xs ${msg === "Saved" ? "text-emerald-700" : "text-red-600"}`}>{msg}</span>}
          </div>
        ) : <Link href={`/admin/products/${r.productId}`} className="text-xs text-slate-500 underline">Enable tracking</Link>}
      </td>
      <td className="px-3 py-2"><Link href={`/admin/inventory/${r.id}`} className="text-xs font-medium text-slate-600 hover:underline">History</Link></td>
    </tr>
  );
}

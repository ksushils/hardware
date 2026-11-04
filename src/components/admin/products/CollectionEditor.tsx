"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { previewSmart, saveCollection, type CollectionInput } from "@/app/actions/admin/collections";
import type { Rule } from "@/lib/collections";

type P = { id: string; name: string; brand: string; image: string; status: string };

export default function CollectionEditor({ initial, products, fields, ops }: { initial: CollectionInput; products: P[]; fields: Record<string, string>; ops: Record<string, string> }) {
  const router = useRouter();
  const [c, setC] = useState(initial);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [preview, setPreview] = useState<{ count: number; sample: { id: string; name: string; image: string }[] } | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof CollectionInput>(k: K, v: CollectionInput[K]) => setC((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (c.type !== "SMART") return;
    const t = setTimeout(() => { previewSmart(c.rules, c.disjunctive, c.sortOrder).then(setPreview).catch(() => null); }, 400);
    return () => clearTimeout(t);
  }, [c.type, c.rules, c.disjunctive, c.sortOrder]);

  const save = () => start(async () => {
    const r = await saveCollection(c);
    if (r.error) return setMsg({ ok: false, text: r.error });
    if (!c.id) router.push(`/admin/collections/${r.id}?saved=1`);
    else { setMsg({ ok: true, text: "Collection saved." }); router.refresh(); }
  });

  const selected = c.productIds.map((id) => products.find((p) => p.id === id)).filter((p): p is P => !!p);
  const results = q.trim() ? products.filter((p) => !c.productIds.includes(p.id) && `${p.name} ${p.brand}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];
  const move = (i: number, d: number) => { const ids = [...c.productIds]; const j = i + d; if (j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; set("productIds", ids); };
  const setRule = (i: number, patch: Partial<Rule>) => set("rules", c.rules.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-4">
      {msg && <div className={`rounded-lg px-4 py-2.5 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</div>}
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <Box>
            <L t="Title"><input className="in-a" value={c.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Summer sale" /></L>
            <L t="Title (Arabic)"><input dir="rtl" className="in-a" value={c.titleAr} onChange={(e) => set("titleAr", e.target.value)} /></L>
            <L t="Description"><textarea className="in-a min-h-20" value={c.description} onChange={(e) => set("description", e.target.value)} /></L>
            <L t="Description (Arabic)"><textarea dir="rtl" className="in-a min-h-20" value={c.descriptionAr} onChange={(e) => set("descriptionAr", e.target.value)} /></L>
          </Box>

          <Box title="Collection type">
            {!c.id ? (
              <div className="space-y-2 text-sm">
                <label className="flex gap-2"><input type="radio" checked={c.type === "MANUAL"} onChange={() => set("type", "MANUAL")} /><span><b>Manual</b>: add products one by one.</span></label>
                <label className="flex gap-2"><input type="radio" checked={c.type === "SMART"} onChange={() => set("type", "SMART")} /><span><b>Smart</b>: products that match conditions are added automatically.</span></label>
              </div>
            ) : <p className="text-sm text-slate-600">{c.type === "SMART" ? "Smart collection: products are added automatically." : "Manual collection."}</p>}
          </Box>

          {c.type === "SMART" ? (
            <Box title="Conditions">
              <div className="mb-3 flex items-center gap-4 text-sm">
                <span>Products must match:</span>
                <label className="flex items-center gap-1"><input type="radio" checked={!c.disjunctive} onChange={() => set("disjunctive", false)} /> all conditions</label>
                <label className="flex items-center gap-1"><input type="radio" checked={c.disjunctive} onChange={() => set("disjunctive", true)} /> any condition</label>
              </div>
              <div className="space-y-2">
                {c.rules.map((r, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                    <select className="in-a" value={r.field} onChange={(e) => setRule(i, { field: e.target.value })}>{Object.entries(fields).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                    <select className="in-a" value={r.op} onChange={(e) => setRule(i, { op: e.target.value })}>{Object.entries(ops).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                    <input className="in-a" value={r.value} onChange={(e) => setRule(i, { value: e.target.value })} placeholder="Value" />
                    <button type="button" className="btn-a" onClick={() => set("rules", c.rules.filter((_, j) => j !== i))} aria-label="Remove condition">✕</button>
                  </div>
                ))}
              </div>
              <button type="button" className="btn-a mt-3" onClick={() => set("rules", [...c.rules, { field: "tag", op: "eq", value: "" }])}>+ Add condition</button>
              {preview && (
                <div className="mt-4 rounded-lg bg-slate-50 p-3">
                  <p className="text-sm font-semibold">{preview.count} matching active product(s)</p>
                  <div className="mt-2 flex flex-wrap gap-2">{preview.sample.map((p) => <span key={p.id} className="flex items-center gap-1.5 rounded border bg-white px-2 py-1 text-xs"><img src={p.image} alt="" className="h-5 w-5 object-contain" />{p.name}</span>)}</div>
                </div>
              )}
            </Box>
          ) : (
            <Box title={`Products (${selected.length})`}>
              <div className="relative">
                <input className="in-a" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products to add" />
                {results.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                    {results.map((p) => (
                      <button type="button" key={p.id} className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm hover:bg-slate-50" onClick={() => { set("productIds", [...c.productIds, p.id]); setQ(""); }}>
                        <img src={p.image} alt="" className="h-7 w-7 object-contain" /> {p.name} <span className="text-xs text-slate-400">{p.brand}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <ul className="mt-3 divide-y divide-slate-100">
                {selected.map((p, i) => (
                  <li key={p.id} className="flex items-center gap-3 py-2 text-sm">
                    <span className="w-6 text-xs text-slate-400">{i + 1}</span>
                    <img src={p.image} alt="" className="h-8 w-8 rounded border object-contain" />
                    <span className="flex-1">{p.name} {p.status !== "ACTIVE" && <span className="ms-1 rounded bg-slate-100 px-1.5 text-[11px] text-slate-500">{p.status.toLowerCase()}</span>}</span>
                    {c.sortOrder === "MANUAL" && <><button type="button" className="btn-a px-2 py-0.5" onClick={() => move(i, -1)}>↑</button><button type="button" className="btn-a px-2 py-0.5" onClick={() => move(i, 1)}>↓</button></>}
                    <button type="button" className="btn-a px-2 py-0.5" onClick={() => set("productIds", c.productIds.filter((x) => x !== p.id))} aria-label="Remove">✕</button>
                  </li>
                ))}
                {!selected.length && <li className="py-4 text-center text-sm text-slate-500">No products yet. Search above to add some.</li>}
              </ul>
            </Box>
          )}

          <Box title="Search engine listing">
            <L t="Page title"><input className="in-a" value={c.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} placeholder={c.title} /></L>
            <L t="Meta description"><textarea className="in-a min-h-16" value={c.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} /></L>
            <L t="URL handle"><div className="flex items-center rounded-lg border border-slate-300 bg-slate-50 ps-3 text-sm text-slate-500">/collections/<input className="w-full rounded-e-lg border-0 bg-white px-2 py-2 text-slate-900 outline-none" value={c.handle} onChange={(e) => set("handle", e.target.value)} /></div></L>
          </Box>
        </div>
        <div className="space-y-4">
          <Box title="Visibility">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={c.published} onChange={(e) => set("published", e.target.checked)} /> Published on online store</label>
            <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={c.showOnHome} onChange={(e) => set("showOnHome", e.target.checked)} /> Show on homepage</label>
          </Box>
          <Box title="Sort products">
            <select className="in-a" value={c.sortOrder} onChange={(e) => set("sortOrder", e.target.value)}>
              {c.type === "MANUAL" && <option value="MANUAL">Manually</option>}
              <option value="BEST">Featured first</option><option value="PRICE_ASC">Price: low to high</option><option value="PRICE_DESC">Price: high to low</option>
              <option value="NEWEST">Newest</option><option value="TITLE">Title A–Z</option>
            </select>
          </Box>
          <Box title="Image">
            {c.image && <img src={c.image} alt="" className="mb-2 aspect-video w-full rounded-lg border object-cover" />}
            <input className="in-a" value={c.image} onChange={(e) => set("image", e.target.value)} placeholder="Image URL" />
            <UploadButton onUploaded={(url) => set("image", url)} />
          </Box>
        </div>
      </div>
      <div className="flex justify-end"><button className="btn-a-primary" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save collection"}</button></div>
    </div>
  );
}

function UploadButton({ onUploaded }: { onUploaded: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <label className="btn-a mt-2 cursor-pointer">
      {busy ? "Uploading…" : "Upload image"}
      <input type="file" accept="image/*" hidden onChange={async (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        setBusy(true);
        const fd = new FormData(); fd.append("file", f);
        const res = await fetch("/api/admin/products/upload", { method: "POST", body: fd });
        const j = await res.json(); setBusy(false);
        if (res.ok) onUploaded(j.files[0].url); else alert(j.error);
      }} />
    </label>
  );
}
function Box({ title, children }: { title?: string; children: React.ReactNode }) {
  return <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">{title && <h2 className="text-sm font-semibold">{title}</h2>}{children}</section>;
}
function L({ t, children }: { t: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">{t}</span>{children}</label>;
}

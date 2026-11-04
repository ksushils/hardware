"use client";
import { useRef, useState } from "react";
import Link from "next/link";

type PreviewProduct = { handle: string; title: string; exists: boolean; status: string; category: string; vendor: string; options: string[]; variants: number; stock: number; priceFrom: number; errors: number };
type Preview = { totalRows: number; errors: { row: number; handle: string; message: string }[]; products: PreviewProduct[] };
type Done = { created: number; updated: number; skipped: number; failed: number; errors: Preview["errors"] };

export default function ImportWizard() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"update" | "skip">("update");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const send = async (commit: boolean) => {
    if (!file) return;
    setBusy(true); setError(null);
    const fd = new FormData();
    fd.append("file", file); fd.append("mode", mode);
    if (commit) fd.append("commit", "1");
    try {
      const res = await fetch("/api/admin/products/import", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Import failed");
      if (commit) setDone(j); else setPreview(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };
  const pick = (f: File | undefined | null) => {
    if (!f) return;
    if (!/\.(xlsx|csv)$/i.test(f.name)) { setError("Please choose a .xlsx or .csv file."); return; }
    setFile(f); setPreview(null); setDone(null); setError(null);
  };
  const reset = () => { setFile(null); setPreview(null); setDone(null); setError(null); if (input.current) input.current.value = ""; };

  if (done)
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">Import complete</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Created" value={done.created} tone="text-emerald-700" /><Stat label="Updated" value={done.updated} tone="text-sky-700" />
          <Stat label="Skipped" value={done.skipped} tone="text-slate-600" /><Stat label="Failed" value={done.failed} tone="text-red-600" />
        </div>
        {done.errors.length > 0 && <ErrorList errors={done.errors} />}
        <div className="mt-5 flex gap-2"><Link href="/admin/products" className="btn-a-primary">View products</Link><button className="btn-a" onClick={reset}>Import another file</button></div>
      </div>
    );

  const valid = preview?.products.filter((p) => !p.errors) ?? [];
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold">1. Download the template</h2>
        <p className="mt-1 text-sm text-slate-600">Use one row per variant. Rows with the same <b>Handle</b> make one product. The Excel template has an <b>Instructions</b> sheet listing every column and valid category.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a className="btn-a" href="/api/admin/products/template?format=xlsx">⬇ Excel template (.xlsx)</a>
          <a className="btn-a" href="/api/admin/products/template?format=csv">⬇ CSV template</a>
          <a className="btn-a" href="/api/admin/products/export?format=xlsx">⬇ Export current products to edit</a>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold">2. Upload your file</h2>
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
          onClick={() => input.current?.click()}
          className={`mt-3 cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${drag ? "border-emerald-500 bg-emerald-50" : "border-slate-300 hover:border-slate-500"}`}
        >
          <p className="text-3xl">📄</p>
          <p className="mt-2 font-semibold">{file ? file.name : "Drop an .xlsx or .csv file here, or click to browse"}</p>
          {file && <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>}
        </div>
        <input ref={input} type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" hidden onChange={(e) => pick(e.target.files?.[0])} />
        <fieldset className="mt-4 space-y-1 text-sm">
          <legend className="mb-1 font-medium">If a product handle already exists</legend>
          <label className="flex items-center gap-2"><input type="radio" checked={mode === "update"} onChange={() => setMode("update")} /> Overwrite existing products (variants not in the file are removed)</label>
          <label className="flex items-center gap-2"><input type="radio" checked={mode === "skip"} onChange={() => setMode("skip")} /> Skip existing products, only create new ones</label>
        </fieldset>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button className="btn-a-primary" disabled={!file || busy} onClick={() => send(false)}>{busy && !preview ? "Checking…" : "Preview import"}</button>
          {file && <button className="btn-a" onClick={reset}>Clear</button>}
        </div>
      </div>

      {preview && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
            <div>
              <h2 className="text-sm font-semibold">3. Review & import</h2>
              <p className="text-sm text-slate-600">
                {preview.totalRows} rows → {preview.products.length} products: <b className="text-emerald-700">{valid.filter((p) => !p.exists).length} new</b>,{" "}
                <b className="text-sky-700">{valid.filter((p) => p.exists).length} {mode === "update" ? "to update" : "existing (will be skipped)"}</b>
                {preview.products.length - valid.length > 0 && <>, <b className="text-red-600">{preview.products.length - valid.length} with errors (skipped)</b></>}
              </p>
            </div>
            <button className="btn-a-primary" disabled={busy || !valid.length} onClick={() => send(true)}>{busy ? "Importing…" : `Import ${valid.length} product(s)`}</button>
          </div>
          {preview.errors.length > 0 && <div className="p-4"><ErrorList errors={preview.errors} /></div>}
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                <tr><th className="px-4 py-2 text-start">Product</th><th className="px-3 py-2 text-start">Action</th><th className="px-3 py-2 text-start">Category</th><th className="px-3 py-2 text-start">Options</th><th className="px-3 py-2 text-start">Variants</th><th className="px-3 py-2 text-start">Stock</th><th className="px-3 py-2 text-start">From</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.products.map((p) => (
                  <tr key={p.handle} className={p.errors ? "bg-red-50/60" : ""}>
                    <td className="px-4 py-2"><p className="font-medium">{p.title || <span className="text-slate-400">(existing title)</span>}</p><p className="text-xs text-slate-500">{p.handle} · {p.vendor} · {p.status}</p></td>
                    <td className="px-3 py-2">{p.errors ? <span className="text-xs font-semibold text-red-600">{p.errors} error(s)</span> : p.exists ? <span className="text-xs font-semibold text-sky-700">{mode === "update" ? "Update" : "Skip"}</span> : <span className="text-xs font-semibold text-emerald-700">Create</span>}</td>
                    <td className="px-3 py-2">{p.category}</td><td className="px-3 py-2">{p.options.join(", ") || "-"}</td>
                    <td className="px-3 py-2">{p.variants}</td><td className="px-3 py-2">{p.stock}</td><td className="px-3 py-2">AED {p.priceFrom}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className="rounded-lg border border-slate-200 p-3"><p className="text-xs text-slate-500">{label}</p><p className={`text-2xl font-bold ${tone}`}>{value}</p></div>;
}
function ErrorList({ errors }: { errors: Preview["errors"] }) {
  return (
    <div className="mt-3 max-h-56 overflow-auto rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      <p className="mb-1 font-semibold">{errors.length} problem(s) found</p>
      <ul className="space-y-0.5">{errors.map((e, i) => <li key={i}><b>Row {e.row}</b>{e.handle && ` (${e.handle})`}: {e.message}</li>)}</ul>
    </div>
  );
}

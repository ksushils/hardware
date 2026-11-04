"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { analyzeSellerImport, commitSellerImport, previewSellerImport } from "@/app/actions/sellerImport";
import type { AnalyzeResult, CommitResult, PreviewResult } from "@/lib/sellerImportCore";
import { Badge, Card, th, td } from "@/components/admin/ui";

type Field = { key: string; label: string; required: boolean; help: string };
type Analyzed = Extract<AnalyzeResult, { ok: true }>;
type Previewed = Extract<PreviewResult, { ok: true }>;

const ACTION_TONE = { create: "green", update: "blue", unchanged: "gray", error: "red" } as const;
const ACTION_LABEL = { create: "New", update: "Update", unchanged: "Unchanged", error: "Error" } as const;

export default function ImportWizard({ fields }: { fields: Field[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [analyzed, setAnalyzed] = useState<Analyzed | null>(null);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [remember, setRemember] = useState(true);
  const [preview, setPreview] = useState<Previewed | null>(null);
  const [mode, setMode] = useState<"partial" | "all_or_nothing">("partial");
  const [result, setResult] = useState<CommitResult | null>(null);

  const reset = () => { setAnalyzed(null); setPreview(null); setResult(null); setError(null); setMapping({}); if (fileRef.current) fileRef.current.value = ""; };

  const upload = () => {
    const f = fileRef.current?.files?.[0];
    if (!f) { setError("Choose a file first."); return; }
    setError(null); setPreview(null); setResult(null);
    const fd = new FormData();
    fd.set("file", f);
    start(async () => {
      const r = await analyzeSellerImport(fd);
      if (!r.ok) { setError(r.error); setAnalyzed(null); return; }
      setAnalyzed(r); setMapping(r.mapping);
    });
  };
  const runPreview = () => {
    if (!analyzed) return;
    setError(null); setResult(null);
    start(async () => {
      const r = await previewSellerImport({ token: analyzed.token, mapping, remember });
      if (!r.ok) { setError(r.error); return; }
      setPreview(r);
    });
  };
  const commit = () => {
    if (!analyzed) return;
    setError(null);
    start(async () => {
      const r = await commitSellerImport({ token: analyzed.token, mode });
      setResult(r);
      if (!r.ok) setError(r.error ?? "Import failed.");
      else router.refresh();
    });
  };

  const missing = fields.filter((f) => f.required && (mapping[f.key] == null || mapping[f.key] < 0));
  const canCommit = preview && preview.missingRequired.length === 0 && preview.counts.create + preview.counts.update > 0 && !result?.ok;

  return (
    <Card title="2 · Upload your file">
      <div className="flex flex-wrap items-center gap-3">
        <input ref={fileRef} type="file" accept=".xlsx,.csv,.txt" className="text-sm" aria-label="Choose an .xlsx or .csv file" onChange={() => { setAnalyzed(null); setPreview(null); setResult(null); setError(null); }} />
        <button type="button" onClick={upload} disabled={pending} className="btn-a-primary">{pending && !analyzed ? "Reading…" : "Upload & read file"}</button>
        {analyzed && <button type="button" onClick={reset} className="btn-a">Start over</button>}
      </div>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700" role="alert">{error}</p>}

      {analyzed && !result?.ok && (
        <div className="mt-6 space-y-6">
          <p className="text-sm text-slate-600">
            <b>{analyzed.filename}</b> · {analyzed.rowCount.toLocaleString()} rows · {analyzed.format.toUpperCase()} · {analyzed.encoding}{analyzed.delimiter ? ` · separator “${analyzed.delimiter === "\t" ? "tab" : analyzed.delimiter}”` : ""}
          </p>

          <section>
            <h3 className="text-sm font-semibold">3 · Match your columns {analyzed.remembered && <span className="font-normal text-slate-500">(we pre-filled this from your last import)</span>}</h3>
            <p className="mb-3 text-sm text-slate-500">Tell us which column of your file holds each piece of information. Leave a field on “not in my file” to skip it: skipped optional fields are left unchanged on existing offers.</p>
            <div className="grid gap-3 md:grid-cols-2">
              {fields.map((f) => (
                <label key={f.key} className="block rounded-lg border border-slate-200 p-3 text-sm">
                  <span className="mb-1 flex items-center justify-between font-medium">{f.label}{f.required && <Badge tone="red">required</Badge>}</span>
                  <select value={mapping[f.key] ?? -1} onChange={(e) => { setMapping({ ...mapping, [f.key]: Number(e.target.value) }); setPreview(null); }} className="in-a">
                    <option value={-1}>— not in my file —</option>
                    {analyzed.headers.map((h, i) => <option key={i} value={i}>{h}{analyzed.sample[0]?.[i] ? `  (e.g. ${analyzed.sample[0][i].slice(0, 30)})` : ""}</option>)}
                  </select>
                  <span className="mt-1 block text-xs text-slate-500">{f.help}</span>
                </label>
              ))}
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-violet-700" /> Remember this column mapping for my next import</label>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button type="button" onClick={runPreview} disabled={pending || missing.length > 0} className="btn-a-primary">{pending ? "Checking…" : "Check my file (preview)"}</button>
              {missing.length > 0 && <span className="text-sm text-red-600">Match the required columns: {missing.map((m) => m.label).join(", ")}</span>}
            </div>
          </section>

          {preview && (
            <section>
              <h3 className="text-sm font-semibold">4 · Preview</h3>
              <div className="my-3 grid grid-cols-2 gap-3 md:grid-cols-5">
                {([["New offers", preview.counts.create, "green"], ["Updates", preview.counts.update, "blue"], ["Unchanged", preview.counts.unchanged, "gray"], ["Rows with errors", preview.counts.error, "red"], ["Sent for review", preview.counts.review, "yellow"]] as const).map(([l, n, tone]) => (
                  <div key={l} className="rounded-lg border border-slate-200 p-3"><p className="text-xs text-slate-500">{l}</p><p className="text-xl font-bold"><Badge tone={tone}>{n}</Badge></p></div>
                ))}
              </div>
              {preview.counts.review > 0 && <p className="mb-3 text-sm text-slate-600">Offers sent for review stay hidden from buyers until our team approves them. Price and stock changes to approved offers apply immediately.</p>}
              {preview.counts.error > 0 && (
                <p className="mb-3 text-sm"><a href={`/api/seller/import/errors?token=${analyzed.token}`} className="font-semibold text-violet-700 underline">⬇ Download the error report (CSV)</a> with every problem row by row.</p>
              )}
              <div className="max-h-96 overflow-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 border-b bg-slate-50"><tr><th className={th}>Row</th><th className={th}>SKU</th><th className={th}>Product</th><th className={th}>Result</th><th className={th}>Details</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.rows.map((r) => (
                      <tr key={r.row} className={r.action === "error" ? "bg-red-50/50" : ""}>
                        <td className={td}>{r.row}</td>
                        <td className={`${td} font-mono text-xs`}>{r.sku}</td>
                        <td className={td}>{r.product ?? r.handle}{r.title && r.title !== "Default Title" && <span className="block text-xs text-slate-500">{r.title}</span>}</td>
                        <td className={td}><Badge tone={ACTION_TONE[r.action]}>{ACTION_LABEL[r.action]}</Badge>{r.review && <span className="ms-1"><Badge tone="yellow">review</Badge></span>}</td>
                        <td className={`${td} text-xs`}>{(r.action === "error" ? r.messages : r.changes).map((m, i) => <span key={i} className={`block ${r.action === "error" ? "text-red-700" : "text-slate-600"}`}>{m}</span>)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.counts.total > preview.shown && <p className="mt-2 text-xs text-slate-500">Showing {preview.shown} of {preview.counts.total} rows (errors first).</p>}

              <fieldset className="mt-4 space-y-2 text-sm">
                <legend className="font-semibold">5 · Import</legend>
                <label className="flex items-start gap-2"><input type="radio" name="mode" checked={mode === "partial"} onChange={() => setMode("partial")} className="mt-1 accent-violet-700" /><span><b>Import valid rows only</b>: rows with errors are skipped and listed in the report.</span></label>
                <label className="flex items-start gap-2"><input type="radio" name="mode" checked={mode === "all_or_nothing"} onChange={() => setMode("all_or_nothing")} className="mt-1 accent-violet-700" /><span><b>All or nothing</b>: if any row has an error, nothing is imported.</span></label>
              </fieldset>
              <p className="mt-2 text-xs text-slate-500">Stock levels are <b>set</b> to the file&apos;s quantities. We re-check every row against the live catalogue when you confirm.</p>
              <button type="button" onClick={commit} disabled={pending || !canCommit} className="btn-a-primary mt-3">{pending ? "Importing…" : `Import ${preview.counts.create + preview.counts.update} change${preview.counts.create + preview.counts.update === 1 ? "" : "s"}`}</button>
              {preview.counts.create + preview.counts.update === 0 && preview.counts.error === 0 && <p className="mt-2 text-sm text-slate-600">Nothing to import: every row already matches your current offers.</p>}
            </section>
          )}
        </div>
      )}

      {result?.ok && result.summary && (
        <div className="mt-6 rounded-xl bg-emerald-50 p-5 text-sm text-emerald-900" role="status">
          <p className="text-base font-bold">Import finished</p>
          <p className="mt-1">{result.summary.created} created · {result.summary.updated} updated · {result.summary.unchanged} unchanged · {result.summary.errors} skipped ({(result.summary.durationMs / 1000).toFixed(1)}s)</p>
          {result.summary.sentForReview > 0 && <p className="mt-1">{result.summary.sentForReview} offer{result.summary.sentForReview === 1 ? " is" : "s are"} waiting for review before going live.</p>}
          {(result.errorCount ?? 0) > 0 && analyzed && <p className="mt-2"><a href={`/api/seller/import/errors?token=${analyzed.token}`} className="font-semibold underline">⬇ Download the error report</a></p>}
          <button type="button" onClick={reset} className="btn-a mt-3">Import another file</button>
        </div>
      )}
    </Card>
  );
}

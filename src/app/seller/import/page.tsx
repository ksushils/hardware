import { requireSeller } from "@/lib/sellerAuth";
import { listHistory } from "@/lib/sellerImport";
import { Card, PageHeader, th, td, Badge } from "@/components/admin/ui";
import ImportWizard from "@/components/marketplace/import/ImportWizard";
import { IMPORT_FIELDS, MAX_BYTES, MAX_ROWS } from "@/lib/sellerImportCore";

export const metadata = { title: "Bulk import offers" };
export const dynamic = "force-dynamic";

export default async function SellerImportPage() {
  const { seller } = await requireSeller();
  const history = await listHistory(seller.id);
  return (
    <>
      <PageHeader title="Bulk import offers" subtitle="Upload an Excel or CSV file to create and update your offers (price, stock, condition, warranty) in one go." />

      <Card title="1 · Download a template" className="mb-5">
        <div className="flex flex-wrap gap-2">
          <a href="/api/seller/import/template?format=xlsx" className="btn-a-primary">⬇ Excel template (.xlsx)</a>
          <a href="/api/seller/import/template?format=csv" className="btn-a">CSV template</a>
          <a href="/api/seller/import/template?format=catalogue" className="btn-a">Catalogue (product handles &amp; options)</a>
          <a href="/api/seller/import/template?format=offers-xlsx" className="btn-a">Export my current offers (.xlsx)</a>
          <a href="/api/seller/import/template?format=offers-csv" className="btn-a">Export my offers (.csv)</a>
        </div>
        <ul className="mt-4 list-disc space-y-1 ps-5 text-sm text-slate-600">
          <li>One row per offer (per specification). You can only add offers to products that are already in the catalogue; to list a product we don&apos;t have yet, use <a href="/seller/products/new" className="font-semibold text-violet-700 underline">Products → New product</a> so it can be reviewed.</li>
          <li><b>Stock is set to the quantity in your file</b>, never added. Re-uploading the same file changes nothing, so it&apos;s always safe to retry.</li>
          <li>New offers, and changes to condition, evidence, photos, warranty or returns, are checked by our team before going live. Price and stock changes apply immediately.</li>
          <li>Max {MAX_ROWS.toLocaleString()} rows and {MAX_BYTES / 1024 / 1024} MB per file. Macro-enabled Excel files (.xlsm) are rejected. Photo links are stored, not downloaded: https image links only.</li>
          <li>Required columns: {IMPORT_FIELDS.filter((f) => f.required).map((f) => <code key={f.key} className="mx-0.5 rounded bg-slate-100 px-1">{f.key}</code>)}</li>
        </ul>
      </Card>

      <ImportWizard fields={IMPORT_FIELDS.map((f) => ({ key: f.key, label: f.label, required: f.required, help: f.help }))} />

      <Card title="Import history" className="mt-5" pad={false}>
        {history.length === 0 ? <p className="p-5 text-sm text-slate-500">No imports yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50"><tr><th className={th}>When</th><th className={th}>File</th><th className={th}>By</th><th className={th}>Created</th><th className={th}>Updated</th><th className={th}>Unchanged</th><th className={th}>Errors</th><th className={th}>Mode</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((h) => (
                  <tr key={h.key}>
                    <td className={td}>{new Date(h.at).toLocaleString("en-AE")}</td>
                    <td className={td}>{h.filename}</td>
                    <td className={td}>{h.user}</td>
                    <td className={td}>{h.summary.created}</td>
                    <td className={td}>{h.summary.updated}</td>
                    <td className={td}>{h.summary.unchanged}</td>
                    <td className={td}>{h.summary.errors ? <Badge tone="red">{h.summary.errors}</Badge> : 0}</td>
                    <td className={td}>{h.summary.mode === "all_or_nothing" ? "All or nothing" : "Valid rows only"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

import { requirePermission } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Card, Field, PageHeader } from "@/components/admin/ui";
import FormShell from "@/components/admin/store/FormShell";
import { saveTaxes } from "@/app/actions/admin/settings";

export const metadata = { title: "Taxes" };

export default async function TaxSettings() {
  await requirePermission("settings");
  const s = await getSettings();
  return (
    <div>
      <PageHeader title="Taxes & duties" back="/admin/settings" />
      <FormShell action={saveTaxes}>
        <Card title="United Arab Emirates">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="VAT rate (%)" help="UAE standard rate is 5%"><input name="rate" type="number" step="0.01" min={0} max={50} defaultValue={s.tax.rate} className="in-a" /></Field>
            <Field label="Tax label on invoices"><input name="label" defaultValue={s.tax.label} className="in-a" /></Field>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked disabled /> All prices include tax (required for UAE consumer pricing)</label>
          <p className="mt-3 text-xs text-slate-500">Your TRN is set in <a href="/admin/settings/general" className="underline">General settings</a> and printed on every tax invoice.</p>
        </Card>
      </FormShell>
    </div>
  );
}

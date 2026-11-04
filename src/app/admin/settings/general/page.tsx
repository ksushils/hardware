import { requirePermission } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Card, Field, PageHeader } from "@/components/admin/ui";
import FormShell from "@/components/admin/store/FormShell";
import { Grid } from "@/components/admin/store/inputs";
import { saveGeneral } from "@/app/actions/admin/settings";

export const metadata = { title: "General settings" };

export default async function GeneralSettings() {
  await requirePermission("settings");
  const s = await getSettings();
  return (
    <div>
      <PageHeader title="General" back="/admin/settings" />
      <FormShell action={saveGeneral}>
        <Card title="Store details">
          <Grid>
            <Field label="Store name"><input name="storeName" required defaultValue={s.storeName} className="in-a" /></Field>
            <Field label="Store name (Arabic)"><input name="storeNameAr" dir="rtl" defaultValue={s.storeNameAr} className="in-a" /></Field>
            <Field label="Legal business name" help="Printed on tax invoices"><input name="legalName" defaultValue={s.legalName} className="in-a" /></Field>
            <Field label="VAT TRN" help="15-digit Tax Registration Number from the FTA"><input name="trn" inputMode="numeric" maxLength={15} defaultValue={s.trn} className="in-a font-mono" /></Field>
          </Grid>
        </Card>
        <Card title="Contact information">
          <Grid>
            <Field label="Customer support email"><input name="email" type="email" defaultValue={s.email} className="in-a" /></Field>
            <Field label="Phone"><input name="phone" defaultValue={s.phone} className="in-a" /></Field>
            <Field label="WhatsApp number" help="International format without +, e.g. 971501234567. Powers the chat button."><input name="whatsapp" defaultValue={s.whatsapp} className="in-a font-mono" /></Field>
            <div />
            <Field label="Address"><input name="address" defaultValue={s.address} className="in-a" /></Field>
            <Field label="Address (Arabic)"><input name="addressAr" dir="rtl" defaultValue={s.addressAr} className="in-a" /></Field>
            <Field label="Opening hours"><input name="hours" defaultValue={s.hours} className="in-a" /></Field>
            <Field label="Opening hours (Arabic)"><input name="hoursAr" dir="rtl" defaultValue={s.hoursAr} className="in-a" /></Field>
          </Grid>
        </Card>
        <Card title="Logo">
          <div className="flex flex-wrap items-center gap-4">
            {s.logoUrl ? <img src={s.logoUrl} alt="Logo" className="h-12 rounded border border-slate-200 bg-white p-1" /> : <span className="text-sm text-slate-500">No logo. The store name is shown as text.</span>}
            <Field label="Logo URL" className="min-w-64 flex-1"><input name="logoUrl" defaultValue={s.logoUrl} className="in-a font-mono text-xs" /></Field>
            <Field label="…or upload"><input type="file" name="logoFile" accept="image/*" className="text-sm" /></Field>
          </div>
        </Card>
        <Card title="Social media">
          <Grid>
            {(["instagram", "facebook", "x", "tiktok", "youtube"] as const).map((k) => (
              <Field key={k} label={k === "x" ? "X (Twitter)" : k[0].toUpperCase() + k.slice(1)}><input name={k} type="url" placeholder="https://" defaultValue={s.social[k]} className="in-a" /></Field>
            ))}
          </Grid>
        </Card>
        <Card title="Homepage SEO">
          <div className="space-y-3">
            <Field label="Homepage title" help="Max 70 characters"><input name="seoTitle" maxLength={70} defaultValue={s.seo.title} className="in-a" /></Field>
            <Field label="Homepage meta description" help="Max 160 characters"><textarea name="seoDescription" maxLength={160} rows={3} defaultValue={s.seo.description} className="in-a" /></Field>
          </div>
        </Card>
      </FormShell>
    </div>
  );
}

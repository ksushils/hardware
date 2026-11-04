import { requirePermission } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Badge, Card, Field, PageHeader } from "@/components/admin/ui";
import FormShell from "@/components/admin/store/FormShell";
import { Toggle } from "@/components/admin/store/inputs";
import { saveLanguages } from "@/app/actions/admin/settings";

export const metadata = { title: "Languages" };

export default async function LanguageSettings() {
  await requirePermission("settings");
  const s = await getSettings();
  return (
    <div>
      <PageHeader title="Languages" back="/admin/settings" />
      <FormShell action={saveLanguages}>
        <Card title="Storefront languages">
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3"><span className="font-medium">English</span><Badge tone="green">Published</Badge></div>
            <div className="rounded-lg border border-slate-200 px-4 py-3">
              <Toggle name="arabicEnabled" label="العربية: Arabic (right-to-left)" help="Shows the language switcher and serves Arabic translations of products, collections, pages and blog posts." defaultChecked={s.languages.arabicEnabled} />
            </div>
            <Field label="Default language for new visitors">
              <select name="defaultLocale" defaultValue={s.languages.defaultLocale} className="in-a max-w-xs">
                <option value="en">English</option><option value="ar">Arabic</option>
              </select>
            </Field>
            <p className="text-xs text-slate-500">Translate content in each product, collection, page and blog post editor (the Arabic fields). Visitors can switch with the language button or <code>?lang=ar</code>.</p>
          </div>
        </Card>
      </FormShell>
    </div>
  );
}

import { requirePermission } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/admin/ui";
import FormShell from "@/components/admin/store/FormShell";
import MenuEditor from "@/components/admin/store/MenuEditor";
import { saveMenus } from "@/app/actions/admin/content";

export const metadata = { title: "Navigation" };

export default async function NavigationPage() {
  await requirePermission("content");
  const s = await getSettings();
  return (
    <div>
      <PageHeader title="Navigation" subtitle="Menus shown in the store header and footer" />
      <FormShell action={saveMenus} submitLabel="Save menus">
        <MenuEditor name="mainMenu" title="Main menu" initial={s.mainMenu} help="Extra header links, shown after Hot Deals and Express (categories are listed automatically)." />
        <MenuEditor name="footerMenu" title="Footer menu" initial={s.footerMenu} help="Links in the footer's Company column." />
        <p className="text-xs text-slate-500">Useful URLs: /collections/&lt;handle&gt; · /category/&lt;slug&gt; · /pages/&lt;handle&gt; · /blog · /deals · /express · /track</p>
      </FormShell>
    </div>
  );
}

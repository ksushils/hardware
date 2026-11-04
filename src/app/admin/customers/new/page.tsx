import { requirePermission } from "@/lib/auth";
import { Card, Field, PageHeader } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/client";
import { Banner, type SP } from "@/components/admin/sales/queries";
import { createCustomer } from "@/app/actions/admin/customers";

export const metadata = { title: "Add customer" };

export default async function NewCustomer({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePermission("customers");
  const sp = await searchParams;
  return (
    <div className="max-w-2xl">
      <PageHeader back="/admin/customers" title="New customer" />
      <Banner sp={sp} />
      <form action={createCustomer} className="space-y-4">
        <Card title="Customer overview">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name"><input name="name" required className="in-a" /></Field>
            <Field label="Email"><input name="email" type="email" required className="in-a" /></Field>
            <Field label="Phone"><input name="phone" placeholder="05X XXX XXXX" className="in-a" /></Field>
            <Field label="Language"><select name="locale" className="in-a"><option value="en">English</option><option value="ar">Arabic</option></select></Field>
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="acceptsMarketing" className="accent-slate-900" /> Customer agreed to receive marketing emails</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="invite" defaultChecked className="accent-slate-900" /> Send account invite (set-password email)</label>
          </div>
        </Card>
        <Card title="Notes & tags">
          <Field label="Note"><textarea name="note" rows={3} className="in-a" /></Field>
          <Field label="Tags" className="mt-3" help="Comma separated, e.g. vip, wholesale"><input name="tags" className="in-a" /></Field>
        </Card>
        <div className="flex justify-end"><SubmitButton>Save customer</SubmitButton></div>
      </form>
    </div>
  );
}

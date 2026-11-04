import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { Card, EmptyState, Field, PageHeader, th, td } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/client";
import FormShell from "@/components/admin/store/FormShell";
import { deleteRedirect, importRedirects, saveRedirect } from "@/app/actions/admin/content";

export const metadata = { title: "URL redirects" };

export default async function RedirectsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePermission("content");
  const { q } = await searchParams;
  const redirects = await db.redirect.findMany({ where: q ? { OR: [{ fromPath: { contains: q } }, { toPath: { contains: q } }] } : {}, orderBy: { createdAt: "desc" }, take: 500 });
  return (
    <div className="space-y-5">
      <PageHeader title="URL redirects" subtitle="Send visitors from old or broken URLs to the right page (301 redirect)" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Create redirect">
          <FormShell action={saveRedirect} submitLabel="Save redirect" resetOnOk>
            <Field label="Redirect from" help="e.g. /old-gpu-page or a full old-site URL"><input name="fromPath" required className="in-a font-mono text-xs" placeholder="/products/old-handle" /></Field>
            <Field label="Redirect to" help="A path on this store, or a full URL"><input name="toPath" required className="in-a font-mono text-xs" placeholder="/products/new-handle" /></Field>
          </FormShell>
        </Card>
        <Card title="Bulk import">
          <FormShell action={importRedirects} submitLabel="Import" resetOnOk>
            <Field label="One redirect per line: from,to"><textarea name="lines" rows={5} className="in-a font-mono text-xs" placeholder={"/old-page,/pages/about\n/shop/gpus,/category/graphics-cards"} /></Field>
          </FormShell>
        </Card>
      </div>
      <Card pad={false} title={`${redirects.length} redirect(s)`} actions={<form><input name="q" defaultValue={q} placeholder="Filter" className="in-a w-48 py-1" /></form>}>
        {redirects.length === 0 ? <EmptyState title="No redirects" description="Add redirects when you change a product handle or migrate from an old site." /> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr><th className={th}>From</th><th className={th}>To</th><th className={`${th} text-end`}>Hits</th><th className={th}></th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {redirects.map((r) => (
                <tr key={r.id}>
                  <td className={`${td} font-mono text-xs`}>{r.fromPath}</td>
                  <td className={`${td} font-mono text-xs`}>{r.toPath}</td>
                  <td className={`${td} text-end tabular-nums`}>{r.hits}</td>
                  <td className={`${td} text-end`}><form action={deleteRedirect}><input type="hidden" name="id" value={r.id} /><ConfirmButton message="Delete this redirect?">Delete</ConfirmButton></form></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getCollectionProducts, parseRules, RULE_FIELDS, RULE_OPS } from "@/lib/collections";
import { Badge, Card, EmptyState, PageHeader, td, th } from "@/components/admin/ui";

export const metadata = { title: "Collections" };

export default async function CollectionsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePermission("products");
  const { q } = await searchParams;
  const collections = await db.collection.findMany({ where: q ? { title: { contains: q } } : {}, orderBy: { title: "asc" } });
  const rows = await Promise.all(collections.map(async (c) => ({ c, count: (await getCollectionProducts(c, { includeInactive: true })).length })));
  return (
    <>
      <PageHeader title="Collections" actions={<Link href="/admin/collections/new" className="btn-a-primary">Create collection</Link>} />
      <Card pad={false}>
        <form className="border-b border-slate-100 p-3"><input name="q" defaultValue={q} placeholder="Search collections" className="in-a max-w-sm" /></form>
        {rows.length ? (
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50"><tr><th className={th}>Title</th><th className={th}>Products</th><th className={th}>Product conditions</th><th className={th}>Status</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(({ c, count }) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className={td}><Link href={`/admin/collections/${c.id}`} className="font-semibold hover:underline">{c.title}</Link><p className="text-xs text-slate-500">/collections/{c.handle}</p></td>
                  <td className={td}>{count}</td>
                  <td className={`${td} text-slate-600`}>
                    {c.type === "SMART"
                      ? parseRules(c.rules).map((r) => `${RULE_FIELDS[r.field as keyof typeof RULE_FIELDS] ?? r.field} ${RULE_OPS[r.op as keyof typeof RULE_OPS] ?? r.op} ${r.value}`).join(c.disjunctive ? " OR " : " AND ")
                      : "Manual"}
                  </td>
                  <td className={td}><span className="flex gap-1">{c.published ? <Badge tone="green">Published</Badge> : <Badge>Hidden</Badge>}{c.showOnHome && <Badge tone="blue">Homepage</Badge>}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState title="No collections" description="Group products into collections to make them easier to browse." action={<Link href="/admin/collections/new" className="btn-a-primary">Create collection</Link>} />}
      </Card>
    </>
  );
}

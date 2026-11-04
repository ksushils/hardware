import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { Card, EmptyState, PageHeader, StatusBadge, th, td } from "@/components/admin/ui";

export const metadata = { title: "Pages" };

export default async function PagesList() {
  await requirePermission("content");
  const pages = await db.page.findMany({ orderBy: { updatedAt: "desc" } });
  return (
    <div>
      <PageHeader title="Pages" subtitle="About, policies, FAQs and other static pages" actions={<Link href="/admin/content/pages/new" className="btn-a-primary">Add page</Link>} />
      <Card pad={false}>
        {pages.length === 0 ? <EmptyState title="No pages yet" action={<Link href="/admin/content/pages/new" className="btn-a-primary">Add page</Link>} /> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr><th className={th}>Title</th><th className={th}>URL</th><th className={th}>Status</th><th className={th}>Updated</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {pages.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className={td}><Link href={`/admin/content/pages/${p.id}`} className="font-semibold hover:underline">{p.title}</Link>{p.titleAr && <span className="ms-2 text-xs text-slate-500" dir="rtl">{p.titleAr}</span>}</td>
                  <td className={`${td} font-mono text-xs text-slate-500`}>/pages/{p.handle}</td>
                  <td className={td}><StatusBadge status={p.published ? "PUBLISHED" : "HIDDEN"} /></td>
                  <td className={`${td} text-slate-500`}>{p.updatedAt.toLocaleDateString("en-AE")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

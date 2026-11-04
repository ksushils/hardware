import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { Card, EmptyState, PageHeader, StatusBadge, th, td } from "@/components/admin/ui";

export const metadata = { title: "Blog posts" };

export default async function BlogList() {
  await requirePermission("content");
  const posts = await db.article.findMany({ orderBy: { publishedAt: "desc" } });
  return (
    <div>
      <PageHeader title="Blog posts" subtitle="Guides and news that help customers and rank in search" actions={<Link href="/admin/content/blog/new" className="btn-a-primary">Create blog post</Link>} />
      <Card pad={false}>
        {posts.length === 0 ? <EmptyState title="No blog posts yet" action={<Link href="/admin/content/blog/new" className="btn-a-primary">Create blog post</Link>} /> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr><th className={th}>Title</th><th className={th}>Author</th><th className={th}>Status</th><th className={th}>Published</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {posts.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className={td}>
                    <div className="flex items-center gap-3">
                      {p.image ? <img src={p.image} alt="" className="h-10 w-14 rounded object-cover" /> : <div className="h-10 w-14 rounded bg-slate-100" />}
                      <div><Link href={`/admin/content/blog/${p.id}`} className="font-semibold hover:underline">{p.title}</Link><p className="font-mono text-xs text-slate-500">/blog/{p.handle}</p></div>
                    </div>
                  </td>
                  <td className={td}>{p.author}</td>
                  <td className={td}><StatusBadge status={p.published ? (p.publishedAt > new Date() ? "PENDING" : "PUBLISHED") : "HIDDEN"} /></td>
                  <td className={`${td} text-slate-500`}>{p.publishedAt.toLocaleDateString("en-AE")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

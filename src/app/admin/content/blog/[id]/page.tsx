import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/client";
import ArticleForm from "@/components/admin/store/ArticleForm";
import { deleteArticle } from "@/app/actions/admin/content";

export const metadata = { title: "Edit blog post" };
export default async function EditArticle({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("content");
  const article = await db.article.findUnique({ where: { id: (await params).id } });
  if (!article) notFound();
  return (
    <>
      <PageHeader title={article.title} back="/admin/content/blog" actions={<>
        <a href={`/blog/${article.handle}`} target="_blank" className="btn-a">View ↗</a>
        <form action={deleteArticle}><input type="hidden" name="id" value={article.id} /><ConfirmButton message="Delete this blog post?">Delete</ConfirmButton></form>
      </>} />
      <ArticleForm article={article} />
    </>
  );
}

import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import ArticleForm from "@/components/admin/store/ArticleForm";

export const metadata = { title: "Create blog post" };
export default async function NewArticle() {
  await requirePermission("content");
  return <><PageHeader title="Create blog post" back="/admin/content/blog" /><ArticleForm /></>;
}

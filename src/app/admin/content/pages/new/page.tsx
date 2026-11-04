import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import PageForm from "@/components/admin/store/PageForm";

export const metadata = { title: "Add page" };
export default async function NewPage() {
  await requirePermission("content");
  return <><PageHeader title="Add page" back="/admin/content/pages" /><PageForm /></>;
}

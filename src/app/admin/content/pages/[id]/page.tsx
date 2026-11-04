import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/client";
import PageForm from "@/components/admin/store/PageForm";
import { deletePage } from "@/app/actions/admin/content";

export const metadata = { title: "Edit page" };
export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("content");
  const page = await db.page.findUnique({ where: { id: (await params).id } });
  if (!page) notFound();
  return (
    <>
      <PageHeader title={page.title} back="/admin/content/pages" actions={<>
        <a href={`/pages/${page.handle}`} target="_blank" className="btn-a">View ↗</a>
        <form action={deletePage}><input type="hidden" name="id" value={page.id} /><ConfirmButton message="Delete this page?">Delete</ConfirmButton></form>
      </>} />
      <PageForm page={page} />
    </>
  );
}

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { Card, EmptyState, PageHeader, Pagination } from "@/components/admin/ui";
import { ConfirmButton, CopyButton } from "@/components/admin/client";
import UploadForm from "@/components/admin/store/UploadForm";
import { deleteFile, updateFileAlt } from "@/app/actions/admin/content";

export const metadata = { title: "Files" };
const PAGE = 40;

export default async function FilesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requirePermission("content");
  const { q, page: p } = await searchParams;
  const page = Math.max(1, Number(p) || 1);
  const where = q ? { OR: [{ filename: { contains: q } }, { alt: { contains: q } }] } : {};
  const [files, total] = await Promise.all([
    db.media.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
    db.media.count({ where }),
  ]);
  const kb = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);
  return (
    <div className="space-y-5">
      <PageHeader title="Files" subtitle="Images and videos for products, blog posts and your homepage" />
      <UploadForm />
      <form><input name="q" defaultValue={q} placeholder="Search files" className="in-a max-w-sm" /></form>
      <Card pad={false}>
        {files.length === 0 ? <EmptyState title="No files yet" description="Uploaded files appear here with a URL you can paste anywhere." /> : (
          <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-4">
            {files.map((f) => (
              <div key={f.id} className="overflow-hidden rounded-lg border border-slate-200">
                <div className="grid aspect-square place-items-center bg-slate-50">
                  {f.mime.startsWith("video/") ? <video src={f.url} muted className="h-full w-full object-cover" /> : <img src={f.url} alt={f.alt} className="h-full w-full object-contain" />}
                </div>
                <div className="space-y-2 p-2.5 text-xs">
                  <p className="truncate font-medium" title={f.filename}>{f.filename}</p>
                  <p className="text-slate-500">{f.mime.split("/")[1]?.toUpperCase()} · {kb(f.size)}</p>
                  <form action={updateFileAlt} className="flex gap-1">
                    <input type="hidden" name="id" value={f.id} />
                    <input name="alt" defaultValue={f.alt} placeholder="Alt text" className="in-a px-2 py-1 text-xs" />
                    <button className="btn-a px-2 py-1 text-xs">Save</button>
                  </form>
                  <div className="flex gap-1">
                    <CopyButton text={f.url} label="Copy URL" />
                    <form action={deleteFile}><input type="hidden" name="id" value={f.id} /><ConfirmButton message="Delete this file? Pages using it will show a broken image." className="btn-a-danger">Delete</ConfirmButton></form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <Pagination page={page} pageSize={PAGE} total={total} makeHref={(n) => `/admin/content/files?page=${n}${q ? `&q=${encodeURIComponent(q)}` : ""}`} />
      </Card>
    </div>
  );
}

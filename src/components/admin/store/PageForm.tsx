import type { Page } from "@prisma/client";
import { savePage } from "@/app/actions/admin/content";
import { Card, Field } from "@/components/admin/ui";
import FormShell from "./FormShell";
import MarkdownEditor from "./MarkdownEditor";

export default function PageForm({ page }: { page?: Page }) {
  return (
    <FormShell action={savePage} submitLabel={page ? "Save page" : "Create page"}>
      {page && <input type="hidden" name="id" value={page.id} />}
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          <Card title="English">
            <div className="space-y-4">
              <Field label="Title"><input name="title" required defaultValue={page?.title} className="in-a" /></Field>
              <MarkdownEditor name="body" label="Content" defaultValue={page?.body} rows={14} />
            </div>
          </Card>
          <Card title="Arabic · العربية">
            <div className="space-y-4">
              <Field label="Title (Arabic)"><input name="titleAr" dir="rtl" defaultValue={page?.titleAr} className="in-a" /></Field>
              <MarkdownEditor name="bodyAr" label="Content (Arabic)" defaultValue={page?.bodyAr} rows={14} dir="rtl" />
            </div>
          </Card>
        </div>
        <div className="space-y-5">
          <Card title="Visibility">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" defaultChecked={page?.published ?? true} className="accent-slate-900" /> Published (visible on the store)</label>
          </Card>
          <Card title="Search engine listing">
            <div className="space-y-3">
              <Field label="URL handle" help={<>Store URL: /pages/<b>{page?.handle ?? "handle"}</b>. Leave blank to generate from the title.</>}><input name="handle" defaultValue={page?.handle} className="in-a font-mono text-xs" /></Field>
              <Field label="Page title" help="Max 70 characters"><input name="seoTitle" maxLength={70} defaultValue={page?.seoTitle ?? ""} className="in-a" /></Field>
              <Field label="Meta description" help="Max 160 characters"><textarea name="seoDescription" maxLength={160} rows={3} defaultValue={page?.seoDescription ?? ""} className="in-a" /></Field>
            </div>
          </Card>
        </div>
      </div>
    </FormShell>
  );
}

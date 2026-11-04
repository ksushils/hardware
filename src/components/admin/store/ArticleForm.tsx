import type { Article } from "@prisma/client";
import { saveArticle } from "@/app/actions/admin/content";
import { Card, Field } from "@/components/admin/ui";
import FormShell from "./FormShell";
import MarkdownEditor from "./MarkdownEditor";

export default function ArticleForm({ article }: { article?: Article }) {
  const d = article?.publishedAt ?? new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return (
    <FormShell action={saveArticle} submitLabel={article ? "Save post" : "Create post"}>
      {article && <input type="hidden" name="id" value={article.id} />}
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          <Card title="English">
            <div className="space-y-4">
              <Field label="Title"><input name="title" required defaultValue={article?.title} className="in-a" /></Field>
              <Field label="Excerpt" help="Shown on the blog listing and used as the meta description."><textarea name="excerpt" rows={2} defaultValue={article?.excerpt} className="in-a" /></Field>
              <MarkdownEditor name="body" label="Content" defaultValue={article?.body} rows={16} />
            </div>
          </Card>
          <Card title="Arabic · العربية">
            <div className="space-y-4">
              <Field label="Title (Arabic)"><input name="titleAr" dir="rtl" defaultValue={article?.titleAr} className="in-a" /></Field>
              <Field label="Excerpt (Arabic)"><textarea name="excerptAr" dir="rtl" rows={2} defaultValue={article?.excerptAr} className="in-a" /></Field>
              <MarkdownEditor name="bodyAr" label="Content (Arabic)" defaultValue={article?.bodyAr} rows={16} dir="rtl" />
            </div>
          </Card>
        </div>
        <div className="space-y-5">
          <Card title="Visibility">
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" defaultChecked={article?.published ?? true} className="accent-slate-900" /> Published</label>
              <Field label="Publish date"><input type="datetime-local" name="publishedAt" defaultValue={local} className="in-a" /></Field>
            </div>
          </Card>
          <Card title="Cover image">
            <div className="space-y-3">
              {article?.image && <img src={article.image} alt="" className="aspect-video w-full rounded-lg border border-slate-200 object-cover" />}
              <Field label="Image URL"><input name="image" defaultValue={article?.image ?? ""} className="in-a font-mono text-xs" placeholder="/uploads/… or https://…" /></Field>
              <Field label="…or upload"><input type="file" name="imageFile" accept="image/*" className="text-sm" /></Field>
            </div>
          </Card>
          <Card title="Organisation">
            <div className="space-y-3">
              <Field label="Author"><input name="author" defaultValue={article?.author ?? "TechRevive Team"} className="in-a" /></Field>
              <Field label="Tags" help="Comma separated"><input name="tags" defaultValue={article?.tags} className="in-a" /></Field>
              <Field label="URL handle" help={<>/blog/<b>{article?.handle ?? "handle"}</b></>}><input name="handle" defaultValue={article?.handle} className="in-a font-mono text-xs" /></Field>
            </div>
          </Card>
        </div>
      </div>
    </FormShell>
  );
}

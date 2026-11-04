"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { updateSettings, type MenuItem } from "@/lib/settings";
import { saveUpload } from "@/lib/uploads";
import { slugify } from "@/lib/format";

type FS = { error?: string; ok?: string } | undefined;
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// ───────── Pages ─────────
export async function savePage(_: FS, fd: FormData): Promise<FS> {
  const user = await requirePermission("content");
  const id = str(fd, "id");
  const title = str(fd, "title");
  if (!title) return { error: "Title is required." };
  const handle = slugify(str(fd, "handle") || title);
  if (!handle) return { error: "Handle is required." };
  const clash = await db.page.findUnique({ where: { handle } });
  if (clash && clash.id !== id) return { error: `Handle "${handle}" is already used by another page.` };
  const data = {
    title, handle, titleAr: str(fd, "titleAr"), body: str(fd, "body"), bodyAr: str(fd, "bodyAr"),
    published: fd.get("published") === "on", seoTitle: str(fd, "seoTitle") || null, seoDescription: str(fd, "seoDescription") || null,
  };
  const page = id ? await db.page.update({ where: { id }, data }) : await db.page.create({ data });
  await logActivity(user, id ? "updated" : "created", "page", `${id ? "Updated" : "Created"} page "${title}"`, page.id);
  revalidatePath("/", "layout");
  if (!id) redirect(`/admin/content/pages/${page.id}?saved=1`);
  return { ok: "Page saved." };
}

export async function deletePage(fd: FormData) {
  const user = await requirePermission("content");
  const page = await db.page.delete({ where: { id: str(fd, "id") } });
  await logActivity(user, "deleted", "page", `Deleted page "${page.title}"`, page.id);
  revalidatePath("/", "layout");
  redirect("/admin/content/pages");
}

// ───────── Blog ─────────
export async function saveArticle(_: FS, fd: FormData): Promise<FS> {
  const user = await requirePermission("content");
  const id = str(fd, "id");
  const title = str(fd, "title");
  if (!title) return { error: "Title is required." };
  const handle = slugify(str(fd, "handle") || title);
  const clash = await db.article.findUnique({ where: { handle } });
  if (clash && clash.id !== id) return { error: `Handle "${handle}" is already used by another post.` };
  let image = str(fd, "image") || null;
  const file = fd.get("imageFile");
  if (file instanceof File && file.size) {
    try {
      image = (await saveUpload(file, title)).url;
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Upload failed." };
    }
  }
  const pub = str(fd, "publishedAt");
  const data = {
    title, handle, titleAr: str(fd, "titleAr"), excerpt: str(fd, "excerpt"), excerptAr: str(fd, "excerptAr"),
    body: str(fd, "body"), bodyAr: str(fd, "bodyAr"), image, author: str(fd, "author") || "TechRevive Team",
    tags: str(fd, "tags"), published: fd.get("published") === "on", publishedAt: pub ? new Date(pub) : new Date(),
  };
  const a = id ? await db.article.update({ where: { id }, data }) : await db.article.create({ data });
  await logActivity(user, id ? "updated" : "created", "article", `${id ? "Updated" : "Created"} blog post "${title}"`, a.id);
  revalidatePath("/", "layout");
  if (!id) redirect(`/admin/content/blog/${a.id}?saved=1`);
  return { ok: "Post saved." };
}

export async function deleteArticle(fd: FormData) {
  const user = await requirePermission("content");
  const a = await db.article.delete({ where: { id: str(fd, "id") } });
  await logActivity(user, "deleted", "article", `Deleted blog post "${a.title}"`, a.id);
  revalidatePath("/", "layout");
  redirect("/admin/content/blog");
}

// ───────── Navigation ─────────
export async function saveMenus(_: FS, fd: FormData): Promise<FS> {
  const user = await requirePermission("content");
  const parse = (key: string): MenuItem[] => {
    try {
      const v = JSON.parse(String(fd.get(key) || "[]"));
      return (Array.isArray(v) ? v : [])
        .map((m: MenuItem) => ({ label: String(m.label || "").trim(), labelAr: String(m.labelAr || "").trim(), url: String(m.url || "").trim() }))
        .filter((m: MenuItem) => m.label && m.url);
    } catch {
      return [];
    }
  };
  const mainMenu = parse("mainMenu");
  const footerMenu = parse("footerMenu");
  // replace arrays (not merge)
  await updateSettings({ mainMenu, footerMenu });
  await logActivity(user, "updated", "navigation", "Updated navigation menus");
  revalidatePath("/", "layout");
  return { ok: "Menus saved." };
}

// ───────── Files ─────────
export async function uploadFiles(_: FS, fd: FormData): Promise<FS> {
  const user = await requirePermission("content");
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { error: "Choose at least one file." };
  const errors: string[] = [];
  let n = 0;
  for (const f of files) {
    try {
      await saveUpload(f);
      n++;
    } catch (e) {
      errors.push(`${f.name}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }
  if (n) await logActivity(user, "created", "file", `Uploaded ${n} file(s)`);
  revalidatePath("/admin/content/files");
  return errors.length ? { error: errors.join("; "), ok: n ? `${n} uploaded.` : undefined } : { ok: `${n} file(s) uploaded.` };
}

export async function updateFileAlt(fd: FormData) {
  await requirePermission("content");
  await db.media.update({ where: { id: str(fd, "id") }, data: { alt: str(fd, "alt") } });
  revalidatePath("/admin/content/files");
}

export async function deleteFile(fd: FormData) {
  const user = await requirePermission("content");
  const m = await db.media.delete({ where: { id: str(fd, "id") } });
  if (m.url.startsWith("/uploads/")) {
    const p = path.join(process.cwd(), "public", "uploads", path.basename(m.url));
    await unlink(p).catch(() => null);
  }
  await logActivity(user, "deleted", "file", `Deleted file ${m.filename}`, m.id);
  revalidatePath("/admin/content/files");
}

// ───────── Redirects ─────────
function normPath(p: string) {
  p = p.trim();
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) {
    try {
      const u = new URL(p);
      p = u.pathname + u.search;
    } catch {
      return "";
    }
  }
  if (!p.startsWith("/")) p = "/" + p;
  return p.length > 1 ? p.replace(/\/$/, "") : p;
}
function normTarget(p: string) {
  p = p.trim();
  if (/^https?:\/\//i.test(p)) return p;
  return normPath(p);
}

export async function saveRedirect(_: FS, fd: FormData): Promise<FS> {
  const user = await requirePermission("content");
  const fromPath = normPath(str(fd, "fromPath"));
  const toPath = normTarget(str(fd, "toPath"));
  if (!fromPath || !toPath) return { error: "Both paths are required." };
  if (fromPath === toPath) return { error: "A redirect can't point to itself." };
  await db.redirect.upsert({ where: { fromPath }, update: { toPath }, create: { fromPath, toPath } });
  await logActivity(user, "created", "redirect", `Redirect ${fromPath} → ${toPath}`);
  revalidatePath("/admin/content/redirects");
  return { ok: "Redirect saved." };
}

export async function importRedirects(_: FS, fd: FormData): Promise<FS> {
  const user = await requirePermission("content");
  const lines = str(fd, "lines").split("\n").map((l) => l.trim()).filter(Boolean);
  let n = 0;
  const bad: number[] = [];
  for (const [i, line] of lines.entries()) {
    const [a, b] = line.split(/[,\t]/);
    const fromPath = normPath(a ?? ""), toPath = normTarget(b ?? "");
    if (!fromPath || !toPath || fromPath === toPath || /^from/i.test(a ?? "")) { if (!/^from/i.test(a ?? "")) bad.push(i + 1); continue; }
    await db.redirect.upsert({ where: { fromPath }, update: { toPath }, create: { fromPath, toPath } });
    n++;
  }
  await logActivity(user, "created", "redirect", `Imported ${n} redirects`);
  revalidatePath("/admin/content/redirects");
  return bad.length ? { ok: `${n} imported.`, error: `Skipped invalid line(s): ${bad.join(", ")}` } : { ok: `${n} redirect(s) imported.` };
}

export async function deleteRedirect(fd: FormData) {
  const user = await requirePermission("content");
  const r = await db.redirect.delete({ where: { id: str(fd, "id") } });
  await logActivity(user, "deleted", "redirect", `Deleted redirect ${r.fromPath}`);
  revalidatePath("/admin/content/redirects");
}

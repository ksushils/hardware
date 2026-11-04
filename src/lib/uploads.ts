import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "./db";

const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml", "video/mp4", "video/webm"];
const MAX = 25 * 1024 * 1024;

/**
 * Saves an uploaded file to /public/uploads and records it in the Media library.
 * For production on serverless hosts, replace with S3 / Cloudflare R2 / Vercel Blob.
 */
export async function saveUpload(file: File, alt = "") {
  if (!file || !file.size) throw new Error("No file");
  if (!ALLOWED.includes(file.type)) throw new Error(`Unsupported file type ${file.type}`);
  if (file.size > MAX) throw new Error("File too large (max 25MB)");
  const ext = path.extname(file.name).toLowerCase().replace(/[^.a-z0-9]/g, "") || "";
  const base = path.basename(file.name, path.extname(file.name)).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "file";
  const name = `${Date.now().toString(36)}-${base}${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  const url = `/uploads/${name}`;
  return db.media.create({ data: { url, filename: file.name, mime: file.type, size: file.size, alt } });
}

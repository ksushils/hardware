// Moves seller licence documents that were saved publicly (/uploads/...) into private storage. Idempotent; safe to re-run.
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { copyFile, mkdir, stat, unlink } from "node:fs/promises";
import path from "node:path";

const db = new PrismaClient();
const PRIVATE_DIR = process.env.PRIVATE_DIR || path.join(process.cwd(), "private-uploads");

const MIME: Record<string, string> = { ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

async function main() {
  const sellers = await db.seller.findMany({ where: { tradeLicenseUrl: { startsWith: "/uploads/" } } });
  await mkdir(PRIVATE_DIR, { recursive: true });
  let moved = 0;
  for (const s of sellers) {
    const rel = s.tradeLicenseUrl!.replace(/^\//, "");
    const src = path.join(process.cwd(), "public", rel);
    if (!src.startsWith(path.join(process.cwd(), "public"))) continue; // path traversal guard
    const info = await stat(src).catch(() => null);
    if (!info) { console.warn(`missing file for ${s.shopName}: ${rel}`); continue; }
    const key = `${Date.now().toString(36)}-${randomBytes(12).toString("hex")}`;
    await copyFile(src, path.join(PRIVATE_DIR, key));
    const pf = await db.privateFile.create({
      data: { storageKey: key, filename: path.basename(src), mime: MIME[path.extname(src).toLowerCase()] ?? "application/octet-stream", size: info.size, ownerType: "SELLER_DOC", ownerId: s.id },
    });
    await db.seller.update({ where: { id: s.id }, data: { tradeLicenseUrl: `/api/files/${pf.id}` } });
    await db.media.deleteMany({ where: { url: s.tradeLicenseUrl! } });
    await unlink(src).catch(() => {});
    moved++;
  }
  console.log(`private-docs: moved ${moved} of ${sellers.length} licence documents to private storage`);
}
main().finally(() => db.$disconnect());

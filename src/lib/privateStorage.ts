import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "./db";
import { getUser } from "./auth";
import { isStaff, hasPermission } from "./permissions";

/**
 * Private file storage for sensitive uploads (trade licences, dispute evidence).
 * Files live OUTSIDE /public (PRIVATE_DIR, default ./private-uploads) and are served only via /api/files/[id],
 * which checks who is asking. Never link to the storage path directly.
 */
export const PRIVATE_DIR = () => process.env.PRIVATE_DIR || path.join(process.cwd(), "private-uploads");
const ALLOWED = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const MAX = 10 * 1024 * 1024;

// content sniffing: never trust the browser-reported MIME alone
function sniff(buf: Buffer): string | null {
  if (buf.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  if (buf[0] === 0x89 && buf.subarray(1, 4).toString() === "PNG") return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

export async function savePrivateFile(file: File, meta: { ownerType: string; ownerId?: string | null; uploadedById?: string | null }) {
  if (!file || !file.size) throw new Error("No file");
  if (file.size > MAX) throw new Error("File too large (max 10MB)");
  const buf = Buffer.from(await file.arrayBuffer());
  const real = sniff(buf);
  if (!real || !ALLOWED.includes(real)) throw new Error("Only PDF, PNG, JPG or WebP files are allowed");
  const key = `${Date.now().toString(36)}-${randomBytes(12).toString("hex")}`;
  await mkdir(PRIVATE_DIR(), { recursive: true });
  await writeFile(path.join(PRIVATE_DIR(), key), buf, { mode: 0o600 });
  const filename = path.basename(file.name).replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "file";
  return db.privateFile.create({ data: { storageKey: key, filename, mime: real, size: buf.length, ownerType: meta.ownerType, ownerId: meta.ownerId ?? null, uploadedById: meta.uploadedById ?? null } });
}

export async function readPrivateFile(storageKey: string) {
  if (!/^[a-z0-9-]+$/i.test(storageKey)) throw new Error("bad key");
  return readFile(path.join(PRIVATE_DIR(), storageKey));
}

const secret = () => process.env.AUTH_SECRET || "dev-secret-change-me-please-0123456789";
/** Short-lived signed link so an authorized user can open/download a file (also usable in emails). */
export function signFileUrl(id: string, ttlSeconds = 600) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = createHmac("sha256", secret()).update(`${id}.${exp}`).digest("hex").slice(0, 32);
  return `/api/files/${id}?exp=${exp}&sig=${sig}`;
}
function verifySig(id: string, exp: string | null, sig: string | null) {
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  const good = createHmac("sha256", secret()).update(`${id}.${exp}`).digest("hex").slice(0, 32);
  return good.length === sig.length && timingSafeEqual(Buffer.from(good), Buffer.from(sig));
}

/** Can the current user read this file? Signed links are only issued after an authorization check elsewhere. */
export async function canReadFile(file: { id: string; ownerType: string; ownerId: string | null }, exp: string | null, sig: string | null) {
  if (verifySig(file.id, exp, sig)) return true;
  const user = await getUser();
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  if (file.ownerType === "SELLER_DOC") {
    if (isStaff(user) && hasPermission(user, "sellers")) return true;
    const seller = await db.seller.findUnique({ where: { userId: user.id }, select: { id: true } });
    return !!seller && seller.id === file.ownerId;
  }
  if (file.ownerType === "CASE" && file.ownerId) {
    if (isStaff(user) && (hasPermission(user, "orders") || hasPermission(user, "customers"))) return true;
    const c = await db.supportCase.findUnique({ where: { id: file.ownerId }, select: { userId: true, sellerId: true } });
    if (!c) return false;
    if (c.userId === user.id) return true;
    if (c.sellerId) {
      const seller = await db.seller.findUnique({ where: { userId: user.id }, select: { id: true } });
      return seller?.id === c.sellerId;
    }
  }
  return false;
}

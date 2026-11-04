import { db } from "@/lib/db";
import { canReadFile, readPrivateFile } from "@/lib/privateStorage";

export const dynamic = "force-dynamic";

// Serves private uploads only to authorized users (owner, involved seller, permitted staff) or via a short-lived signed link.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const file = await db.privateFile.findUnique({ where: { id } });
  if (!file || !(await canReadFile(file, url.searchParams.get("exp"), url.searchParams.get("sig")))) return new Response("Not found", { status: 404 });
  const body = await readPrivateFile(file.storageKey).catch(() => null);
  if (!body) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": file.mime,
      "Content-Disposition": `inline; filename="${file.filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}

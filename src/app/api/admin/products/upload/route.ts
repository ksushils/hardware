import { saveUpload } from "@/lib/uploads";
import { forbidden, productsGuard } from "../guard";

// Media upload for the product/collection editors (route handler avoids the server-action body size limit).
export async function POST(req: Request) {
  if (!(await productsGuard())) return forbidden();
  const fd = await req.formData();
  const files = fd.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return Response.json({ error: "No file" }, { status: 400 });
  try {
    const saved = [];
    for (const f of files.slice(0, 20)) saved.push(await saveUpload(f, String(fd.get("alt") || "")));
    return Response.json({ files: saved.map((m) => ({ url: m.url, alt: m.alt })) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Upload failed" }, { status: 400 });
  }
}

import { revalidatePath } from "next/cache";
import { applyImport, parseFile, validateRows } from "@/lib/productImport";
import { logActivity } from "@/lib/activity";
import { forbidden, productsGuard } from "../guard";

const MAX_BYTES = 10 * 1024 * 1024;

// POST multipart: file, mode=update|skip, commit=1 to apply. The file is re-parsed and re-validated on commit.
export async function POST(req: Request) {
  const user = await productsGuard();
  if (!user) return forbidden();
  const fd = await req.formData();
  const file = fd.get("file");
  if (!(file instanceof File) || !file.size) return Response.json({ error: "Choose a .xlsx or .csv file." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "File is larger than 10MB." }, { status: 400 });
  let rows;
  try {
    rows = await parseFile(Buffer.from(await file.arrayBuffer()), file.name);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Could not read the file." }, { status: 400 });
  }
  if (!rows.length) return Response.json({ error: "The file has no product rows." }, { status: 400 });
  const result = await validateRows(rows);
  const mode = fd.get("mode") === "skip" ? "skip" : "update";

  if (fd.get("commit") !== "1") {
    return Response.json({
      totalRows: result.totalRows,
      errors: result.errors.slice(0, 500),
      products: result.products.map((p) => ({
        handle: p.handle, title: p.title, exists: p.exists, status: p.status, category: p.categoryLabel, vendor: p.vendor,
        options: p.options.map((o) => o.name), variants: p.variants.length, stock: p.variants.reduce((s, v) => s + v.stock, 0),
        priceFrom: p.variants.length ? Math.min(...p.variants.map((v) => v.price)) : 0, errors: p.errors.length,
      })),
    });
  }
  const summary = await applyImport(result.products, mode, user.id);
  await logActivity(user, "imported", "product", `Imported products from ${file.name}: ${summary.created} created, ${summary.updated} updated, ${summary.skipped} skipped, ${summary.failed} failed`);
  revalidatePath("/", "layout");
  return Response.json({ ok: true, ...summary, errors: result.errors.slice(0, 500) });
}

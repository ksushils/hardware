"use server";
import { revalidatePath } from "next/cache";
import { requireSeller } from "@/lib/sellerAuth";
import { logActivity } from "@/lib/activity";
import { rateLimit } from "@/lib/rateLimit";
import {
  applyPlans, createDraft, loadDraft, loadRememberedMapping, parseUpload, planImport, rememberMapping, saveDraft,
} from "@/lib/sellerImport";
import { FIELD_KEYS, autoMap, type AnalyzeResult, type CommitResult, type PreviewResult, type PreviewRow } from "@/lib/sellerImportCore";

/** Step 1: read the file, detect format/encoding/delimiter, suggest a column mapping and keep the parsed rows server-side. */
export async function analyzeSellerImport(formData: FormData): Promise<AnalyzeResult> {
  const { seller } = await requireSeller();
  if (!rateLimit(`seller-import:${seller.id}`, 30, 3600)) return { ok: false, error: "Too many uploads. Please wait a while and try again." };
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return { ok: false, error: "Choose a file to upload." };
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const parsed = await parseUpload(buf, file.name);
    const remembered = await loadRememberedMapping(seller.id);
    const mapping = autoMap(parsed.headers, remembered);
    const draft = await createDraft(seller.id, parsed, file.name, mapping);
    return {
      ok: true, token: draft.token, filename: draft.filename, headers: parsed.headers, sample: parsed.rows.slice(0, 5), rowCount: parsed.rows.length,
      encoding: parsed.encoding, delimiter: parsed.delimiter, format: parsed.format, mapping, remembered: Object.keys(remembered).length > 0,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "We couldn't read this file." };
  }
}

function cleanMapping(input: Record<string, number>, width: number): Record<string, number> | string {
  const out: Record<string, number> = {};
  const used = new Set<number>();
  for (const [k, v] of Object.entries(input ?? {})) {
    if (!FIELD_KEYS.includes(k)) continue;
    if (!Number.isInteger(v) || v < 0) continue; // unmapped
    if (v >= width) return "That column doesn't exist in the file.";
    if (used.has(v)) return "Each file column can be used for only one field.";
    used.add(v);
    out[k] = v;
  }
  return out;
}

/** Step 2/3: apply the chosen mapping and validate every row against the live catalogue. Writes nothing. */
export async function previewSellerImport(input: { token: string; mapping: Record<string, number>; remember: boolean }): Promise<PreviewResult> {
  const { seller } = await requireSeller();
  const draft = await loadDraft(seller.id, String(input?.token ?? ""));
  if (!draft) return { ok: false, error: "This upload has expired. Please upload the file again." };
  const mapping = cleanMapping(input.mapping, draft.headers.length);
  if (typeof mapping === "string") return { ok: false, error: mapping };
  const plan = await planImport(seller, draft.headers, draft.rows, mapping);
  draft.mapping = mapping;
  draft.lastErrors = plan.issues;
  await saveDraft(draft);
  if (input.remember) await rememberMapping(seller.id, draft.headers, mapping);
  const toRow = (p: (typeof plan.plans)[number]): PreviewRow => ({ row: p.row, sku: p.sku, handle: p.handle, product: p.productName, title: p.title, action: p.action, messages: p.messages, changes: p.changes, review: !!p.sentForReview });
  const errors = plan.plans.filter((p) => p.action === "error");
  const rest = plan.plans.filter((p) => p.action !== "error");
  const rows = [...errors.slice(0, 150), ...rest.slice(0, 300 - Math.min(150, errors.length))].map(toRow);
  return { ok: true, counts: plan.counts, missingRequired: plan.missingRequired, rows, shown: rows.length };
}

/** Step 4: re-validates against the CURRENT database state (never trusts the earlier preview) and writes. */
export async function commitSellerImport(input: { token: string; mode: "partial" | "all_or_nothing" }): Promise<CommitResult> {
  const { user, seller } = await requireSeller();
  const draft = await loadDraft(seller.id, String(input?.token ?? ""));
  if (!draft) return { ok: false, error: "This upload has expired. Please upload the file again." };
  if (draft.result) return { ok: false, error: "This file was already imported. Upload it again to re-run it (re-running is safe: stock is set, not added)." };
  const mode = input.mode === "all_or_nothing" ? "all_or_nothing" : "partial";
  const plan = await planImport(seller, draft.headers, draft.rows, draft.mapping);
  if (plan.missingRequired.length) return { ok: false, error: `Map these required columns first: ${plan.missingRequired.join(", ")}.` };
  const res = await applyPlans(seller, plan.plans, mode, { filename: draft.filename, userName: user.name });
  if (!res.ok || !res.summary) return { ok: false, error: res.error ?? "Import failed.", errorCount: res.rowErrors.length };
  draft.lastErrors = res.rowErrors;
  draft.result = res.summary;
  await saveDraft(draft);
  await logActivity({ id: user.id, name: user.name }, "imported", "offers", `Seller ${seller.shopName} imported ${draft.filename}: ${res.summary.created} created, ${res.summary.updated} updated, ${res.summary.errors} errors`, seller.id);
  revalidatePath("/", "layout");
  revalidatePath("/seller/import");
  return { ok: true, summary: { ...res.summary }, errorCount: res.rowErrors.length };
}

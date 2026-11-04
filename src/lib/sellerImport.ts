import "server-only";
import { randomBytes } from "node:crypto";
import ExcelJS from "exceljs";
import type { Prisma, Seller, Variant } from "@prisma/client";
import { db } from "./db";
import { getSettings } from "./settings";
import { notifyBackInStock } from "./orders";
import { parseValues } from "./format";
import {
  EXAMPLE_SKU_PREFIX, EVIDENCE_KEYS, FIELD_KEYS, IMPORT_FIELDS, MAX_CELL_CHARS, MAX_COLUMNS, MAX_ROWS, MAX_TOTAL_CHARS, REQUIRED_KEYS, TERMS_KEYS,
  autoMap, classifyUpload, decimals, decodeText, detectDelimiter, normalizeConditionType, normalizeHeader, normalizeWarrantyProvider, parseCsvText, parseIntStrict, parseNumber, toCsv, validatePhotoUrl,
} from "./sellerImportCore";

type SellerRef = Pick<Seller, "id" | "slug" | "shopName">;

// ───────────────────────── reading the upload ─────────────────────────

export type ParsedUpload = { format: "csv" | "xlsx"; encoding: string; delimiter: string | null; headers: string[]; rows: string[][] };

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value as unknown;
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    const o = v as { richText?: { text: string }[]; text?: string; result?: unknown };
    if (o.richText) return o.richText.map((r) => r.text).join("").trim();
    if (o.text != null) return String(o.text).trim();
    if (o.result != null) return String(o.result).trim();
    return "";
  }
  return String(v).trim();
}

/** Parses an uploaded CSV/XLSX into headers + rows with all the safety limits applied. Throws Error(userMessage). */
export async function parseUpload(buf: Buffer, filename: string): Promise<ParsedUpload> {
  const kind = classifyUpload(filename, buf);
  if (!kind.ok) throw new Error(kind.error);
  let matrix: string[][];
  let encoding = "UTF-8";
  let delimiter: string | null = null;
  if (kind.kind === "csv") {
    const d = decodeText(buf);
    encoding = d.encoding;
    delimiter = detectDelimiter(d.text);
    matrix = parseCsvText(d.text, delimiter);
  } else {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buf as unknown as ArrayBuffer);
    } catch {
      throw new Error("We couldn't read this .xlsx file. Re-save it from Excel or Google Sheets and try again.");
    }
    const ws = wb.getWorksheet("Offers") ?? wb.worksheets.find((w) => !["instructions", "catalogue"].includes(w.name.toLowerCase())) ?? wb.worksheets[0];
    if (!ws) throw new Error("The workbook has no sheets.");
    matrix = [];
    const cols = Math.min(Math.max(ws.actualColumnCount, ws.columnCount), MAX_COLUMNS + 1);
    ws.eachRow({ includeEmpty: false }, (row) => {
      if (matrix.length > MAX_ROWS + 50) return;
      const vals: string[] = [];
      for (let c = 1; c <= cols; c++) vals.push(cellText(row.getCell(c)));
      matrix.push(vals);
    });
  }
  matrix = matrix.filter((r) => r.some((c) => c && c.trim()));
  if (matrix.length < 2) throw new Error("The file needs a header row and at least one data row.");
  const width = Math.max(...matrix.slice(0, 50).map((r) => r.length));
  if (width > MAX_COLUMNS) throw new Error(`Too many columns (max ${MAX_COLUMNS}).`);
  const headers = Array.from({ length: width }, (_, i) => (matrix[0][i] ?? "").replace(/^﻿/, "").trim() || `Column ${i + 1}`);
  const rows = matrix.slice(1);
  if (rows.length > MAX_ROWS) throw new Error(`Too many rows (${rows.length}). The limit is ${MAX_ROWS.toLocaleString()} rows per file: split it into smaller files.`);
  let chars = 0;
  const clipped = rows.map((r) => Array.from({ length: width }, (_, i) => {
    const v = (r[i] ?? "").trim();
    chars += v.length;
    return v.length > MAX_CELL_CHARS ? v.slice(0, MAX_CELL_CHARS) : v;
  }));
  if (chars > MAX_TOTAL_CHARS) throw new Error("The file contains too much text. Split it into smaller files.");
  return { format: kind.kind, encoding, delimiter, headers, rows: clipped };
}

// ───────────────────────── drafts, mapping memory, history (Setting table) ─────────────────────────

export type RowIssue = { row: number; sku: string; handle: string; message: string };
export type ImportSummary = { created: number; updated: number; unchanged: number; errors: number; skipped: number; mode: "partial" | "all_or_nothing"; finishedAt: string; durationMs: number; sentForReview: number };
export type Draft = {
  token: string; sellerId: string; filename: string; format: "csv" | "xlsx"; encoding: string; delimiter: string | null;
  headers: string[]; rows: string[][]; mapping: Record<string, number>; createdAt: string; lastErrors?: RowIssue[]; result?: ImportSummary;
};

const draftKey = (sellerId: string, token: string) => `seller-import-draft:${sellerId}:${token}`;
const DRAFT_TTL_MS = 60 * 60 * 1000;

export async function createDraft(sellerId: string, up: ParsedUpload, filename: string, mapping: Record<string, number>) {
  await cleanupDrafts(sellerId);
  const token = randomBytes(12).toString("hex");
  const draft: Draft = { token, sellerId, filename: filename.slice(0, 200), format: up.format, encoding: up.encoding, delimiter: up.delimiter, headers: up.headers, rows: up.rows, mapping, createdAt: new Date().toISOString() };
  await db.setting.create({ data: { key: draftKey(sellerId, token), value: JSON.stringify(draft) } });
  return draft;
}
export async function loadDraft(sellerId: string, token: string): Promise<Draft | null> {
  if (!/^[a-f0-9]{24}$/.test(token)) return null;
  const row = await db.setting.findUnique({ where: { key: draftKey(sellerId, token) } });
  if (!row) return null;
  try {
    const d = JSON.parse(row.value) as Draft;
    return Date.now() - new Date(d.createdAt).getTime() > DRAFT_TTL_MS ? null : d;
  } catch {
    return null;
  }
}
export async function saveDraft(d: Draft) {
  await db.setting.update({ where: { key: draftKey(d.sellerId, d.token) }, data: { value: JSON.stringify(d) } });
}
export async function cleanupDrafts(sellerId: string) {
  const rows = await db.setting.findMany({ where: { key: { startsWith: `seller-import-draft:${sellerId}:` } } });
  for (const r of rows) {
    try {
      if (Date.now() - new Date((JSON.parse(r.value) as Draft).createdAt).getTime() > DRAFT_TTL_MS) await db.setting.delete({ where: { key: r.key } });
    } catch {
      await db.setting.delete({ where: { key: r.key } }).catch(() => null);
    }
  }
}

const mapKey = (sellerId: string) => `seller-import-map:${sellerId}`;
/** Remembered column mapping for this seller: normalized header → field key. */
export async function loadRememberedMapping(sellerId: string): Promise<Record<string, string>> {
  const row = await db.setting.findUnique({ where: { key: mapKey(sellerId) } });
  try {
    return row ? (JSON.parse(row.value) as Record<string, string>) : {};
  } catch {
    return {};
  }
}
export async function rememberMapping(sellerId: string, headers: string[], mapping: Record<string, number>) {
  const memory: Record<string, string> = {};
  for (const [field, idx] of Object.entries(mapping)) if (idx >= 0 && headers[idx] && FIELD_KEYS.includes(field)) memory[normalizeHeader(headers[idx])] = field;
  await db.setting.upsert({ where: { key: mapKey(sellerId) }, update: { value: JSON.stringify(memory) }, create: { key: mapKey(sellerId), value: JSON.stringify(memory) } });
}

export type HistoryItem = { key: string; at: string; filename: string; user: string; summary: ImportSummary };
export async function listHistory(sellerId: string, limit = 15): Promise<HistoryItem[]> {
  const rows = await db.setting.findMany({ where: { key: { startsWith: `seller-import-log:${sellerId}:` } }, orderBy: { key: "desc" }, take: limit });
  const out: HistoryItem[] = [];
  for (const r of rows) {
    try {
      const j = JSON.parse(r.value) as { filename: string; user: string; summary: ImportSummary };
      out.push({ key: r.key, at: r.key.split(`seller-import-log:${sellerId}:`)[1], filename: j.filename, user: j.user, summary: j.summary });
    } catch { /* ignore corrupt rows */ }
  }
  return out;
}

// ───────────────────────── planning ─────────────────────────

export type RowPlan = {
  row: number; sku: string; handle: string; productName?: string; title?: string;
  action: "create" | "update" | "unchanged" | "error";
  messages: string[]; changes: string[];
  create?: Prisma.VariantUncheckedCreateInput; patch?: Prisma.VariantUncheckedUpdateManyInput; variantId?: string; productId?: string;
  stockDelta?: number; wasOutOfStock?: boolean; sentForReview?: boolean;
};
export type PlanResult = { plans: RowPlan[]; counts: { total: number; create: number; update: number; unchanged: number; error: number; review: number }; issues: RowIssue[]; missingRequired: string[] };

const nsSku = (slug: string, raw: string) => `${slug}:${raw}`;
const stripNs = (slug: string, sku: string) => (sku.startsWith(`${slug}:`) ? sku.slice(slug.length + 1) : sku);
const lc = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
const same = (a: unknown, b: unknown) => (a ?? null) === (b ?? null);

/**
 * Validates every row against the live catalogue and the seller's existing offers, and decides create / update / unchanged / error.
 * Nothing is written. Offers are keyed by (seller, SKU): re-running the same file produces only "unchanged" rows.
 */
export async function planImport(seller: SellerRef, headers: string[], rows: string[][], mapping: Record<string, number>): Promise<PlanResult> {
  const settings = await getSettings();
  const autoApprove = settings.marketplace.autoApproveProducts;
  const mapped = new Set(Object.keys(mapping).filter((k) => mapping[k] >= 0 && mapping[k] < headers.length));
  const missingRequired = REQUIRED_KEYS.filter((k) => !mapped.has(k));
  const cell = (r: string[], k: string) => (mapped.has(k) ? (r[mapping[k]] ?? "").trim() : undefined);
  if (missingRequired.length) return { plans: [], counts: { total: rows.length, create: 0, update: 0, unchanged: 0, error: 0, review: 0 }, issues: [], missingRequired };

  const handles = [...new Set(rows.map((r) => (cell(r, "product_handle") ?? "").toLowerCase()).filter(Boolean))];
  const rawSkus = [...new Set(rows.map((r) => stripNs(seller.slug, cell(r, "seller_sku") ?? "")).filter(Boolean))];
  const products = handles.length ? await db.product.findMany({ where: { slug: { in: handles } }, include: { options: { orderBy: { position: "asc" } } } }) : [];
  const prodBySlug = new Map(products.map((p) => [p.slug, p]));
  const productIds = products.map((p) => p.id);
  const mine = await db.variant.findMany({ where: { sellerId: seller.id, OR: [{ sku: { in: [...rawSkus, ...rawSkus.map((s) => nsSku(seller.slug, s))] } }, { productId: { in: productIds } }] } });
  const takenElsewhere = rawSkus.length ? await db.variant.findMany({ where: { sku: { in: rawSkus.map((s) => nsSku(seller.slug, s)) } }, select: { id: true, sku: true, sellerId: true } }) : [];
  const maxPos = await db.variant.groupBy({ by: ["productId"], where: { productId: { in: productIds } }, _max: { position: true } });
  const nextPos = new Map(maxPos.map((m) => [m.productId, (m._max.position ?? -1) + 1]));

  const seenSku = new Map<string, number>();
  const seenSpec = new Map<string, number>();
  const plans: RowPlan[] = [];

  rows.forEach((r, idx) => {
    const rowNo = idx + 2; // spreadsheet row number (header is row 1)
    const msgs: string[] = [];
    const rawSkuIn = cell(r, "seller_sku") ?? "";
    const rawSku = stripNs(seller.slug, rawSkuIn);
    const handle = (cell(r, "product_handle") ?? "").toLowerCase();
    const plan: RowPlan = { row: rowNo, sku: rawSku, handle, action: "error", messages: msgs, changes: [] };

    // ── SKU
    if (!rawSku) msgs.push("seller_sku is required");
    else if (!/^[A-Za-z0-9][A-Za-z0-9._\-/ ]{0,63}$/.test(rawSku)) msgs.push("seller_sku may only contain letters, numbers and . _ - / (max 64 characters)");
    else if (rawSku.toUpperCase().startsWith(EXAMPLE_SKU_PREFIX)) msgs.push("this is an example row from the template: delete it or give it your own SKU");
    else {
      const k = rawSku.toLowerCase();
      if (seenSku.has(k)) msgs.push(`duplicate seller_sku in this file (first used on row ${seenSku.get(k)})`);
      else seenSku.set(k, rowNo);
    }

    // ── product (never created here)
    const product = handle ? prodBySlug.get(handle) : undefined;
    if (!handle) msgs.push("product_handle is required");
    else if (!product) msgs.push(`unknown product "${handle}": create it via Products → New product so it can be moderated`);
    else if (product.status !== "ACTIVE" || product.approvalStatus !== "APPROVED") msgs.push(`product "${handle}" isn't open for new offers right now (it is not live in the catalogue)`);
    plan.productId = product?.id;
    plan.productName = product ? `${product.brand} ${product.name}` : undefined;

    // ── specification: option values must be among the product's declared values
    let option: (string | null)[] = [null, null, null];
    let title = "Default Title";
    let specOk = false;
    if (product) {
      const given = [cell(r, "option1_value"), cell(r, "option2_value"), cell(r, "option3_value")].map((v) => (v ?? "").trim());
      const opts = product.options.map((o) => ({ name: o.name, values: parseValues(o.values) }));
      if (opts.length === 0) {
        if (given.some(Boolean)) msgs.push("this product has no options: leave the option_value columns empty");
        else specOk = true;
      } else {
        const chosen: string[] = [];
        opts.forEach((o, i) => {
          const v = given[i];
          if (!v) { msgs.push(`option${i + 1}_value is required: "${o.name}" (allowed: ${o.values.join(", ")})`); return; }
          const hit = o.values.find((x) => lc(x) === lc(v));
          if (!hit) msgs.push(`unknown specification: "${v}" is not a "${o.name}" of this product (allowed: ${o.values.join(", ")})`);
          else chosen.push(hit);
        });
        for (let i = opts.length; i < 3; i++) if (given[i]) msgs.push(`this product only has ${opts.length} option${opts.length === 1 ? "" : "s"}: leave option${i + 1}_value empty`);
        if (chosen.length === opts.length && !given.slice(opts.length).some(Boolean)) { option = [chosen[0] ?? null, chosen[1] ?? null, chosen[2] ?? null]; title = chosen.join(" / "); specOk = true; }
      }
    }
    plan.title = title;

    // ── numbers & enums
    const priceRaw = cell(r, "price") ?? "";
    const price = parseNumber(priceRaw);
    if (!priceRaw) msgs.push("price is required");
    else if (!Number.isFinite(price) || price <= 0) msgs.push(`price "${priceRaw}" must be a number greater than 0`);
    else if (price > 1_000_000) msgs.push("price is too high (max AED 1,000,000)");
    else if (decimals(price) > 2) msgs.push("price can have at most 2 decimals");
    const qtyRaw = cell(r, "quantity") ?? "";
    const qty = parseIntStrict(qtyRaw);
    if (!qtyRaw) msgs.push("quantity is required");
    else if (!Number.isInteger(qty) || qty < 0 || qty > 100_000) msgs.push(`quantity "${qtyRaw}" must be a whole number between 0 and 100,000`);

    const ctRaw = cell(r, "condition_type") ?? "";
    const conditionType = normalizeConditionType(ctRaw);
    if (!ctRaw) msgs.push("condition_type is required (NEW, OPEN_BOX, REFURBISHED, USED or PARTS)");
    else if (!conditionType) msgs.push(`condition_type "${ctRaw}" isn't recognised (use NEW, OPEN_BOX, REFURBISHED, USED or PARTS)`);

    const text = (k: string, max: number): string | null | undefined => {
      const v = cell(r, k);
      if (v === undefined) return undefined;
      if (v.length > max) { msgs.push(`${k} is too long (max ${max} characters)`); return undefined; }
      return v || null;
    };
    const intField = (k: string, lo: number, hi: number): number | null | undefined => {
      const v = cell(r, k);
      if (v === undefined) return undefined;
      if (v === "") return null;
      const n = parseIntStrict(v);
      if (!Number.isInteger(n) || n < lo || n > hi) { msgs.push(`${k} "${v}" must be a whole number between ${lo} and ${hi}`); return undefined; }
      return n;
    };
    const cosmeticGrade = text("cosmetic_grade", 40);
    const functionalStatus = text("functional_status", 120);
    const repairDisclosure = text("repair_disclosure", 1000);
    const accessories = text("accessories", 300);
    const testNotes = text("test_notes", 1000);
    const warrantyTerms = text("warranty_terms", 1000);
    const returnTerms = text("return_terms", 1000);
    const batteryHealth = intField("battery_health_percent", 0, 100);
    const batteryCycles = intField("battery_cycles", 0, 5000);
    const warrantyMonths = intField("warranty_months", 0, 60);
    const returnDays = intField("return_days", 0, 90);
    const handlingDays = intField("handling_days", 0, 30);
    let warrantyProvider: string | null | undefined;
    const wpRaw = cell(r, "warranty_provider");
    if (wpRaw !== undefined) {
      if (!wpRaw) warrantyProvider = null;
      else {
        const wp = normalizeWarrantyProvider(wpRaw);
        if (!wp) msgs.push(`warranty_provider "${wpRaw}" isn't recognised (SELLER, MANUFACTURER or NONE)`);
        else if (wp === "KARAT") msgs.push("warranty_provider can't be set to the platform: only SELLER, MANUFACTURER or NONE");
        else warrantyProvider = wp;
      }
    }
    let photos: string[] | undefined;
    const phRaw = cell(r, "photo_urls");
    if (phRaw !== undefined) {
      const list = phRaw.split("|").map((x) => x.trim()).filter(Boolean);
      if (list.length > 10) msgs.push("photo_urls has more than 10 links");
      for (const u of list) { const e = validatePhotoUrl(u); if (e) msgs.push(e); }
      photos = list;
    }

    // ── matching to the seller's own offers
    const ns = rawSku ? nsSku(seller.slug, rawSku) : "";
    const existing = rawSku ? mine.find((v) => v.sku === ns || v.sku === rawSku) : undefined;
    if (rawSku && !existing) {
      const clash = takenElsewhere.find((v) => v.sku === ns);
      if (clash) msgs.push(`SKU "${rawSku}" is already in use by another offer: choose a different SKU`);
    }
    if (product && existing && existing.productId !== product.id) msgs.push(`SKU "${rawSku}" is already used for a different product: use a new SKU or correct product_handle`);
    if (product && specOk) {
      if (existing && existing.productId === product!.id && (existing.title !== title)) msgs.push(`SKU "${rawSku}" is already used for the specification "${existing.title}": one SKU per specification`);
      const dup = mine.find((v) => v.productId === product!.id && v.title === title && v.id !== existing?.id);
      if (dup) msgs.push(`you already have an offer for "${title}" on this product (SKU ${stripNs(seller.slug, dup.sku ?? "")}): use that SKU to update it`);
      const specKey = `${product!.id}|${title}`;
      if (seenSpec.has(specKey) && !msgs.some((m) => m.startsWith("duplicate seller_sku"))) msgs.push(`another row in this file already offers "${title}" for this product (row ${seenSpec.get(specKey)})`);
      else if (!seenSpec.has(specKey)) seenSpec.set(specKey, rowNo);
    }

    if (msgs.length || !product || !Number.isFinite(price) || !Number.isInteger(qty) || !conditionType) {
      plans.push({ ...plan, action: "error" });
      return;
    }

    // ── final field values (only columns the seller mapped are touched on update)
    const provided: Record<string, unknown> = {
      conditionType, cosmeticGrade, functionalStatus, batteryHealth, batteryCycles, repairDisclosure, accessories, testNotes,
      warrantyProvider, warrantyMonths, warrantyTerms, returnDays, returnTerms,
      ...(photos !== undefined ? { photos: JSON.stringify(photos) } : {}),
    };
    for (const k of Object.keys(provided)) if (provided[k] === undefined) delete provided[k];
    const hasEvidence = (o: Record<string, unknown>) => ["batteryHealth", "batteryCycles", "repairDisclosure", "functionalStatus", "testNotes"].some((k) => o[k] != null && o[k] !== "") || (typeof o.photos === "string" && o.photos !== "[]" && o.photos !== "");

    if (!existing) {
      const verification = hasEvidence(provided) ? "SELLER_DECLARED" : "NONE";
      const pos = nextPos.get(product.id) ?? 0;
      nextPos.set(product.id, pos + 1);
      plan.action = "create";
      plan.create = {
        productId: product.id, title, option1: option[0], option2: option[1], option3: option[2], price, stock: qty, sku: ns,
        trackInventory: true, continueSelling: false, position: pos, sellerId: seller.id, approvalStatus: autoApprove ? "APPROVED" : "PENDING",
        handlingDays: handlingDays ?? 1, verification, ...provided,
      } as Prisma.VariantUncheckedCreateInput;
      plan.sentForReview = !autoApprove;
      plan.stockDelta = qty;
      plan.changes = [`new offer · AED ${price} · ${qty} in stock`];
      plans.push(plan);
      return;
    }

    // update: diff against the stored offer
    const changes: string[] = [];
    const patch: Record<string, unknown> = {};
    let termsChanged = false;
    if (!same(existing.price, price)) { patch.price = price; changes.push(`price ${existing.price} → ${price}`); }
    if (existing.stock !== qty) { patch.stock = qty; changes.push(`stock ${existing.stock} → ${qty}`); }
    if (handlingDays != null && existing.handlingDays !== handlingDays) { patch.handlingDays = handlingDays; changes.push(`handling ${existing.handlingDays} → ${handlingDays} days`); }
    for (const [k, v] of Object.entries(provided)) {
      if (!same((existing as Record<string, unknown>)[k], v)) { patch[k] = v; termsChanged = true; changes.push(`${k} changed`); }
    }
    if (!changes.length) {
      plans.push({ ...plan, action: "unchanged", variantId: existing.id, productId: product.id, title });
      return;
    }
    if (termsChanged) {
      const merged = { ...(existing as Record<string, unknown>), ...patch };
      const evidence = hasEvidence(merged);
      patch.verification = evidence ? "SELLER_DECLARED" : "NONE"; // altering verified evidence removes the platform badge
      patch.approvalStatus = autoApprove ? "APPROVED" : "PENDING";
      patch.rejectionReason = null;
    } else if (existing.approvalStatus === "REJECTED") {
      patch.approvalStatus = autoApprove ? "APPROVED" : "PENDING"; // a corrected, resubmitted offer
      patch.rejectionReason = null;
    }
    plan.action = "update";
    plan.variantId = existing.id;
    plan.patch = patch as Prisma.VariantUncheckedUpdateManyInput;
    plan.stockDelta = qty - existing.stock;
    plan.wasOutOfStock = existing.stock <= 0 && qty > 0;
    plan.sentForReview = patch.approvalStatus === "PENDING";
    plan.changes = changes;
    plans.push(plan);
  });

  const issues: RowIssue[] = plans.flatMap((p) => (p.action === "error" ? p.messages.map((m) => ({ row: p.row, sku: p.sku, handle: p.handle, message: m })) : []));
  const counts = {
    total: plans.length,
    create: plans.filter((p) => p.action === "create").length,
    update: plans.filter((p) => p.action === "update").length,
    unchanged: plans.filter((p) => p.action === "unchanged").length,
    error: plans.filter((p) => p.action === "error").length,
    review: plans.filter((p) => p.sentForReview).length,
  };
  return { plans, counts, issues, missingRequired: [] };
}

// ───────────────────────── applying ─────────────────────────

const lockKey = (sellerId: string) => `seller-import-lock:${sellerId}`;
const LOCK_STALE_MS = 10 * 60 * 1000;

/** One import per seller at a time. The lock row's primary key makes acquisition atomic; stale locks (10 min) are reclaimed. */
export async function acquireLock(sellerId: string): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await db.setting.create({ data: { key: lockKey(sellerId), value: new Date().toISOString() } });
      return true;
    } catch {
      const row = await db.setting.findUnique({ where: { key: lockKey(sellerId) } });
      if (row && Date.now() - new Date(row.value).getTime() > LOCK_STALE_MS) await db.setting.delete({ where: { key: lockKey(sellerId) } }).catch(() => null);
      else return false;
    }
  }
  return false;
}
export async function releaseLock(sellerId: string) {
  await db.setting.delete({ where: { key: lockKey(sellerId) } }).catch(() => null);
}

export type ApplyResult = { ok: boolean; error?: string; summary?: ImportSummary; rowErrors: RowIssue[] };

const CHUNK = 200;

/**
 * Writes the planned creates/updates. Stock is SET (never incremented) and every change is recorded in the inventory log,
 * so re-running a file is idempotent. "all_or_nothing" aborts before writing if any row has an error and runs in ONE transaction;
 * "partial" skips bad rows and commits the rest in chunks of 200.
 */
export async function applyPlans(seller: SellerRef, plans: RowPlan[], mode: "partial" | "all_or_nothing", ctx: { filename: string; userName: string }): Promise<ApplyResult> {
  const started = Date.now();
  const errors = plans.filter((p) => p.action === "error");
  const rowErrors: RowIssue[] = errors.flatMap((p) => p.messages.map((m) => ({ row: p.row, sku: p.sku, handle: p.handle, message: m })));
  if (mode === "all_or_nothing" && errors.length) return { ok: false, error: `${errors.length} row${errors.length === 1 ? " has" : "s have"} errors, so nothing was imported. Fix them (download the error report) or choose "Import valid rows only".`, rowErrors };
  if (!(await acquireLock(seller.id))) return { ok: false, error: "Another import for your shop is still running. Wait a few minutes and try again.", rowErrors };
  const work = plans.filter((p) => p.action === "create" || p.action === "update");
  let created = 0, updated = 0, sentForReview = 0;
  const restocked: string[] = [];
  const failed: RowIssue[] = [];
  try {
    const writeOne = async (tx: Prisma.TransactionClient, p: RowPlan) => {
      if (p.action === "create" && p.create) {
        const exists = await tx.variant.findUnique({ where: { sku: p.create.sku as string }, select: { id: true } });
        if (exists) throw new Error(`SKU "${p.sku}" is already in use`);
        const v = await tx.variant.create({ data: p.create });
        if ((p.create.stock ?? 0) > 0) await tx.inventoryAdjustment.create({ data: { variantId: v.id, delta: p.create.stock as number, reason: "received", note: "Seller bulk import" } });
        created++;
      } else if (p.action === "update" && p.variantId && p.patch) {
        // scoped by seller: an import can never touch someone else's offer
        const r = await tx.variant.updateMany({ where: { id: p.variantId, sellerId: seller.id }, data: p.patch });
        if (r.count !== 1) throw new Error("offer not found");
        if (p.stockDelta) await tx.inventoryAdjustment.create({ data: { variantId: p.variantId, delta: p.stockDelta, reason: "correction", note: "Seller bulk import (stock set to file quantity)" } });
        if (p.wasOutOfStock) restocked.push(p.variantId);
        updated++;
      }
      if (p.sentForReview) sentForReview++;
    };
    if (mode === "all_or_nothing") {
      try {
        await db.$transaction(async (tx) => { for (const p of work) await writeOne(tx, p); }, { timeout: 120_000, maxWait: 30_000 });
      } catch (e) {
        created = 0; updated = 0; sentForReview = 0; restocked.length = 0;
        return { ok: false, error: `Nothing was imported: ${e instanceof Error ? e.message : "database error"}.`, rowErrors };
      }
    } else {
      for (let i = 0; i < work.length; i += CHUNK) {
        const chunk = work.slice(i, i + CHUNK);
        const before = { created, updated, sentForReview, restocked: restocked.length };
        try {
          await db.$transaction(async (tx) => { for (const p of chunk) await writeOne(tx, p); }, { timeout: 60_000, maxWait: 30_000 });
        } catch (e) {
          created = before.created; updated = before.updated; sentForReview = before.sentForReview; restocked.length = before.restocked;
          const msg = e instanceof Error ? e.message : "database error";
          // retry row by row so one bad row doesn't sink its whole batch
          for (const p of chunk) {
            try {
              await db.$transaction(async (tx) => { await writeOne(tx, p); }, { timeout: 15_000 });
            } catch (e2) {
              failed.push({ row: p.row, sku: p.sku, handle: p.handle, message: e2 instanceof Error ? e2.message : msg });
            }
          }
        }
      }
    }
  } finally {
    await releaseLock(seller.id);
  }
  for (const id of restocked) await notifyBackInStock(id).catch(() => null);
  const summary: ImportSummary = {
    created, updated, unchanged: plans.filter((p) => p.action === "unchanged").length, errors: errors.length + failed.length,
    skipped: errors.length + failed.length, mode, finishedAt: new Date().toISOString(), durationMs: Date.now() - started, sentForReview,
  };
  const at = summary.finishedAt;
  await db.setting.create({ data: { key: `seller-import-log:${seller.id}:${at}`, value: JSON.stringify({ filename: ctx.filename, user: ctx.userName, summary }) } }).catch(() => null);
  return { ok: true, summary, rowErrors: [...rowErrors, ...failed] };
}

// ───────────────────────── downloads ─────────────────────────

export function errorsCsv(issues: RowIssue[]): string {
  return toCsv(["row", "seller_sku", "product_handle", "problem"], issues.map((i) => [i.row, i.sku, i.handle, i.message]));
}

type CatalogueRow = { handle: string; name: string; brand: string; category: string; opts: { name: string; values: string[] }[] };
async function catalogue(): Promise<CatalogueRow[]> {
  const products = await db.product.findMany({ where: { status: "ACTIVE", approvalStatus: "APPROVED" }, include: { options: { orderBy: { position: "asc" } }, category: true }, orderBy: { name: "asc" }, take: 2000 });
  return products.map((p) => ({ handle: p.slug, name: p.name, brand: p.brand, category: p.category.name, opts: p.options.map((o) => ({ name: o.name, values: parseValues(o.values) })) }));
}
const CAT_HEADERS = ["product_handle", "name", "brand", "category", "option1_name", "option1_values", "option2_name", "option2_values", "option3_name", "option3_values"];
const catRow = (c: CatalogueRow) => [c.handle, c.name, c.brand, c.category, ...[0, 1, 2].flatMap((i) => [c.opts[i]?.name ?? "", c.opts[i]?.values.join(" | ") ?? ""])];

export async function catalogueCsv() {
  return toCsv(CAT_HEADERS, (await catalogue()).map(catRow));
}

async function exampleRows(): Promise<string[][]> {
  const cat = (await catalogue()).slice(0, 2);
  const cols = FIELD_KEYS;
  return cat.map((c, i) => {
    const ex: Record<string, string> = Object.fromEntries(IMPORT_FIELDS.map((f) => [f.key, f.example]));
    ex.seller_sku = `${EXAMPLE_SKU_PREFIX}${String(i + 1).padStart(3, "0")}`;
    ex.product_handle = c.handle;
    ex.option1_value = c.opts[0]?.values[0] ?? "";
    ex.option2_value = c.opts[1]?.values[0] ?? "";
    ex.option3_value = c.opts[2]?.values[0] ?? "";
    ex.photo_urls = "";
    return cols.map((k) => ex[k] ?? "");
  });
}

export async function templateCsv() {
  return toCsv(FIELD_KEYS, await exampleRows());
}

export async function templateXlsx(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TechRevive Seller Centre";
  const ws = wb.addWorksheet("Offers", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = FIELD_KEYS.map((k) => ({ header: k, key: k, width: Math.max(14, k.length + 2) }));
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4C1D95" } };
  IMPORT_FIELDS.forEach((f, i) => { if (f.required) ws.getRow(1).getCell(i + 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB91C1C" } }; });
  for (const r of await exampleRows()) ws.addRow(r);
  const g = wb.addWorksheet("Instructions");
  g.columns = [{ header: "Column", key: "c", width: 26 }, { header: "Required", key: "r", width: 10 }, { header: "How to fill it", key: "h", width: 110 }, { header: "Example", key: "e", width: 40 }];
  g.getRow(1).font = { bold: true };
  IMPORT_FIELDS.forEach((f) => g.addRow({ c: f.key, r: f.required ? "YES" : "", h: f.help, e: f.example }));
  g.addRow({});
  g.addRow({ c: "Rules", h: "One row per offer (per specification). Delete the example rows (SKUs starting EXAMPLE-). Stock is SET to the quantity you upload. New or changed condition/evidence/terms are re-checked by our team before they go live; price and stock changes apply immediately. You can only change your own offers." });
  const cws = wb.addWorksheet("Catalogue");
  cws.columns = CAT_HEADERS.map((h) => ({ header: h, key: h, width: h.endsWith("values") ? 50 : 24 }));
  cws.getRow(1).font = { bold: true };
  (await catalogue()).forEach((c) => cws.addRow(catRow(c)));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** The seller's current offers in the import format, so prices and stock can be edited in bulk and re-uploaded. */
export async function offersExportRows(seller: SellerRef): Promise<string[][]> {
  const vs = await db.variant.findMany({ where: { sellerId: seller.id }, include: { product: true }, orderBy: [{ productId: "asc" }, { position: "asc" }] });
  const val = (v: Variant, k: string): string => {
    const m: Record<string, unknown> = {
      seller_sku: stripNs(seller.slug, v.sku ?? ""), product_handle: "", option1_value: v.option1, option2_value: v.option2, option3_value: v.option3, condition_type: v.conditionType, cosmetic_grade: v.cosmeticGrade,
      functional_status: v.functionalStatus, battery_health_percent: v.batteryHealth, battery_cycles: v.batteryCycles, price: v.price, quantity: v.stock, handling_days: v.handlingDays,
      warranty_provider: v.warrantyProvider, warranty_months: v.warrantyMonths, warranty_terms: v.warrantyTerms, return_days: v.returnDays, return_terms: v.returnTerms,
      accessories: v.accessories, repair_disclosure: v.repairDisclosure, photo_urls: parseValues(v.photos).join("|"), test_notes: v.testNotes,
    };
    return m[k] == null ? "" : String(m[k]);
  };
  return vs.map((v) => FIELD_KEYS.map((k) => (k === "product_handle" ? v.product.slug : val(v, k))));
}
export async function offersExportCsv(seller: SellerRef) {
  return toCsv(FIELD_KEYS, await offersExportRows(seller));
}
export async function offersExportXlsx(seller: SellerRef): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Offers", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = FIELD_KEYS.map((k) => ({ header: k, key: k, width: Math.max(14, k.length + 2) }));
  ws.getRow(1).font = { bold: true };
  (await offersExportRows(seller)).forEach((r) => ws.addRow(r.map((c) => (/^[=+\-@\t\r]/.test(c) ? `'${c}` : c))));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export { TERMS_KEYS, EVIDENCE_KEYS, autoMap };

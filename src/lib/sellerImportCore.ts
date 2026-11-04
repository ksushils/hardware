// Pure helpers for the seller bulk import (no database, no "server-only"), so they can be unit-tested and reused by the wizard UI.

export const MAX_BYTES = 10 * 1024 * 1024;
export const MAX_ROWS = 2000;
export const MAX_COLUMNS = 60;
export const MAX_CELL_CHARS = 2000;
export const MAX_TOTAL_CHARS = 4_000_000;
export const EXAMPLE_SKU_PREFIX = "EXAMPLE-";

export type ImportField = { key: string; label: string; required: boolean; help: string; example: string; synonyms: string[] };

export const IMPORT_FIELDS: ImportField[] = [
  { key: "seller_sku", label: "Seller SKU", required: true, help: "Your own unique code for this offer. Re-uploading the same SKU updates the offer instead of creating a duplicate.", example: "RTX4070S-VG-001", synonyms: ["sku", "sellersku", "itemcode", "partnumber", "رمز", "رمزالمنتج", "رقمالصنف"] },
  { key: "product_handle", label: "Product handle", required: true, help: "The catalogue product you are offering (see the Catalogue sheet / download). Unknown products are rejected: create them via Products → New product so they can be moderated.", example: "nvidia-geforce-rtx-4070-super-12gb", synonyms: ["handle", "producthandle", "productslug", "slug", "product", "productid"] },
  { key: "option1_value", label: "Option 1 value", required: false, help: "Value of the product's first option, e.g. the Condition (Excellent / Very Good / Good). Must be one of the values listed in the Catalogue sheet.", example: "Very Good", synonyms: ["option1", "option1value", "option1val"] },
  { key: "option2_value", label: "Option 2 value", required: false, help: "Value of the product's second option (e.g. Capacity), if it has one.", example: "2TB", synonyms: ["option2", "option2value", "option2val"] },
  { key: "option3_value", label: "Option 3 value", required: false, help: "Value of the product's third option, if it has one.", example: "", synonyms: ["option3", "option3value", "option3val"] },
  { key: "condition_type", label: "Condition type", required: true, help: "NEW, OPEN_BOX, REFURBISHED, USED or PARTS. This is the commercial condition shown to buyers and printed on the invoice.", example: "REFURBISHED", synonyms: ["conditiontype", "commercialcondition", "itemcondition", "حالةالمنتج"] },
  { key: "cosmetic_grade", label: "Cosmetic grade", required: false, help: "Appearance, e.g. Excellent / Very Good / Good. Describe it honestly: buyers can return items not as described.", example: "Very Good", synonyms: ["cosmeticgrade", "grade", "cosmetic"] },
  { key: "functional_status", label: "Functional status", required: false, help: "e.g. Fully functional. Disclose any defect here.", example: "Fully functional", synonyms: ["functionalstatus", "functional", "workingstatus"] },
  { key: "battery_health_percent", label: "Battery health %", required: false, help: "0–100. Only for items with a battery. Leave blank if not measured (do not guess).", example: "91", synonyms: ["batteryhealth", "battery", "batteryhealthpercent", "batteryhealth%", "صحةالبطارية"] },
  { key: "battery_cycles", label: "Battery cycles", required: false, help: "Charge cycle count, if known.", example: "212", synonyms: ["batterycycles", "cyclecount", "cycles"] },
  { key: "price", label: "Price (AED)", required: true, help: "Retail price in AED, VAT included, up to 2 decimals.", example: "1899", synonyms: ["price", "unitprice", "sellingprice", "priceaed", "aed", "السعر"] },
  { key: "quantity", label: "Quantity", required: true, help: "Units in stock. The stock level is SET to this number (not added), so re-uploading the same file never doubles your stock.", example: "4", synonyms: ["quantity", "qty", "stock", "stocklevel", "available", "onhand", "الكمية", "المخزون"] },
  { key: "handling_days", label: "Handling days", required: false, help: "Business days you need to dispatch after an order (0–30, default 1). Used for delivery estimates.", example: "1", synonyms: ["handling", "handlingtime", "handlingdays", "dispatchdays", "leadtime"] },
  { key: "warranty_provider", label: "Warranty provider", required: false, help: "SELLER, MANUFACTURER or NONE. Never label a seller warranty as a manufacturer warranty.", example: "SELLER", synonyms: ["warrantyprovider", "warrantyby"] },
  { key: "warranty_months", label: "Warranty months", required: false, help: "0–60.", example: "12", synonyms: ["warrantymonths", "warranty", "warrantyduration"] },
  { key: "warranty_terms", label: "Warranty terms", required: false, help: "What is covered, exclusions and how to claim (max 1,000 characters).", example: "Covers functional defects; excludes physical and liquid damage.", synonyms: ["warrantyterms", "warrantydetails"] },
  { key: "return_days", label: "Return days", required: false, help: "0–90. You cannot remove consumer rights required by law.", example: "14", synonyms: ["returndays", "returnwindow", "returnperiod"] },
  { key: "return_terms", label: "Return terms", required: false, help: "Conditions for returns (max 1,000 characters).", example: "Item must be returned complete with accessories.", synonyms: ["returnterms", "returnpolicy"] },
  { key: "accessories", label: "Accessories included", required: false, help: "e.g. Original box, power cable.", example: "Original box, 2 PCIe cables", synonyms: ["accessories", "included", "includedaccessories"] },
  { key: "repair_disclosure", label: "Repair disclosure", required: false, help: "Repairs done and replaced parts. Write 'None' if none.", example: "Thermal paste replaced", synonyms: ["repairs", "repairdisclosure", "replacedparts"] },
  { key: "photo_urls", label: "Photo URLs", required: false, help: "Photos of the ACTUAL unit, separated by |. https links ending in .jpg .jpeg .png .webp .gif or .avif (max 10). We store the links only; we never download them.", example: "https://cdn.example.com/u1/front.jpg|https://cdn.example.com/u1/back.jpg", synonyms: ["photos", "images", "imageurls", "photourls", "imageurl", "pictures"] },
  { key: "test_notes", label: "Test notes", required: false, help: "What you tested and the result. Shown to buyers as a seller declaration, not as platform verification.", example: "2h stress test passed, 71°C max", synonyms: ["testnotes", "notes", "testing", "diagnostics"] },
];
export const FIELD_KEYS = IMPORT_FIELDS.map((f) => f.key);
export const REQUIRED_KEYS = IMPORT_FIELDS.filter((f) => f.required).map((f) => f.key);
/** Fields that describe the item itself (evidence, condition and terms). Changing any of them re-submits the offer for moderation. */
export const TERMS_KEYS = ["condition_type", "cosmetic_grade", "functional_status", "battery_health_percent", "battery_cycles", "repair_disclosure", "accessories", "photo_urls", "test_notes", "warranty_provider", "warranty_months", "warranty_terms", "return_days", "return_terms"];
/** Declared evidence: when any of these has a value the offer is labelled "seller-declared". */
export const EVIDENCE_KEYS = ["battery_health_percent", "battery_cycles", "repair_disclosure", "functional_status", "photo_urls", "test_notes"];

export const normalizeHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9%؀-ۿ]/g, "");

/** Maps file headers to fields: remembered mapping first (header → field), then the field's own name and synonyms. Returns field → column index. */
export function autoMap(headers: string[], remembered: Record<string, string> = {}): Record<string, number> {
  const out: Record<string, number> = {};
  const used = new Set<number>();
  const norm = headers.map(normalizeHeader);
  headers.forEach((_, i) => {
    const f = remembered[norm[i]];
    if (f && FIELD_KEYS.includes(f) && out[f] == null) { out[f] = i; used.add(i); }
  });
  for (const f of IMPORT_FIELDS) {
    if (out[f.key] != null) continue;
    const names = new Set([normalizeHeader(f.key), normalizeHeader(f.label), ...f.synonyms.map(normalizeHeader)]);
    const idx = norm.findIndex((h, i) => !used.has(i) && names.has(h));
    if (idx >= 0) { out[f.key] = idx; used.add(idx); }
  }
  return out;
}

// ───────────── text decoding / CSV ─────────────

export function decodeText(buf: Buffer): { text: string; encoding: string } {
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return { text: buf.subarray(3).toString("utf8"), encoding: "UTF-8 (BOM)" };
  if (buf[0] === 0xff && buf[1] === 0xfe) return { text: new TextDecoder("utf-16le").decode(buf.subarray(2)), encoding: "UTF-16 LE" };
  if (buf[0] === 0xfe && buf[1] === 0xff) return { text: new TextDecoder("utf-16be").decode(buf.subarray(2)), encoding: "UTF-16 BE" };
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(buf), encoding: "UTF-8" };
  } catch {
    try {
      return { text: new TextDecoder("windows-1256").decode(buf), encoding: "Windows-1256 (Arabic)" };
    } catch {
      return { text: buf.toString("latin1"), encoding: "Latin-1" };
    }
  }
}

/** Counts candidate delimiters in the header line (outside quotes) and picks the most frequent. */
export function detectDelimiter(text: string): string {
  const line = text.replace(/^﻿/, "").split(/\r\n|\n|\r/).find((l) => l.trim()) ?? "";
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0, "|": 0 };
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (!q && ch in counts) counts[ch]++;
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : ",";
}

export function parseCsvText(text: string, delimiter = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delimiter) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** Spreadsheet-formula injection guard: cells starting with = + - @ (or tab/CR) get a leading apostrophe so Excel treats them as text. */
export function safeCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}
export function csvEscape(s: string) {
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
/** Builds a CSV (UTF-8 BOM so Excel opens Arabic correctly) with every cell formula-injection-safe. */
export function toCsv(headers: string[], rows: unknown[][]): string {
  return "﻿" + [headers, ...rows].map((r) => r.map((c) => csvEscape(safeCell(c))).join(",")).join("\r\n");
}

// ───────────── file safety ─────────────

export type ZipCheck = { ok: true } | { ok: false; error: string };

/**
 * Inspects an .xlsx (ZIP) container BEFORE it is decompressed: rejects macros, zip bombs, path traversal names,
 * ZIP64 and files that aren't workbooks. We never extract to disk, but we refuse hostile archives anyway.
 */
export function inspectZip(buf: Buffer): ZipCheck {
  if (buf.length < 22 || buf.readUInt32LE(0) !== 0x04034b50) return { ok: false, error: "This isn't a valid .xlsx file." };
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return { ok: false, error: "This .xlsx file is corrupted." };
  const entries = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (entries === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) return { ok: false, error: "ZIP64 archives aren't supported. Save the file again as a normal .xlsx or .csv." };
  if (entries > 500) return { ok: false, error: "This .xlsx file has an unusual structure (too many parts)." };
  let p = cdOffset, total = 0, hasWorkbook = false;
  for (let n = 0; n < entries; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) return { ok: false, error: "This .xlsx file is corrupted." };
    const comp = buf.readUInt32LE(p + 20), uncomp = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    if (name.split(/[\\/]/).includes("..") || name.startsWith("/") || name.startsWith("\\") || /^[a-zA-Z]:/.test(name)) return { ok: false, error: "This file contains unsafe paths and was rejected." };
    if (/vbaproject\.bin$/i.test(name) || /\.(exe|dll|bat|cmd|js|vbs|ps1|sh)$/i.test(name)) return { ok: false, error: "Files containing macros or executable content are not accepted. Save a clean .xlsx or .csv." };
    if (name === "xl/workbook.xml") hasWorkbook = true;
    total += uncomp;
    if (uncomp > 1_000_000 && comp > 0 && uncomp / comp > 200) return { ok: false, error: "This file looks like a decompression bomb and was rejected." };
    p += 46 + nameLen + extraLen + commentLen;
  }
  if (total > 80 * 1024 * 1024) return { ok: false, error: "This workbook expands to too much data (over 80 MB). Split it into smaller files." };
  if (!hasWorkbook) return { ok: false, error: "This isn't a valid Excel workbook." };
  return { ok: true };
}

export type FileKind = { ok: true; kind: "csv" | "xlsx" } | { ok: false; error: string };

/** Decides what the upload really is from its name AND its bytes. */
export function classifyUpload(filename: string, buf: Buffer): FileKind {
  const name = filename.toLowerCase().trim();
  if (buf.length === 0) return { ok: false, error: "The file is empty." };
  if (buf.length > MAX_BYTES) return { ok: false, error: `The file is too large (max ${MAX_BYTES / 1024 / 1024} MB).` };
  if (/\.(xlsm|xlsb|xltm|xls|xlam)$/.test(name)) return { ok: false, error: "Macro-enabled and legacy Excel formats aren't accepted. Save the file as .xlsx or .csv and upload again." };
  const isZip = buf.readUInt32LE(0) === 0x04034b50;
  const isOle = buf.length > 4 && buf.readUInt32BE(0) === 0xd0cf11e0;
  if (name.endsWith(".xlsx")) {
    if (!isZip) return { ok: false, error: "This isn't a real .xlsx file (re-save it from Excel or Google Sheets)." };
    const z = inspectZip(buf);
    return z.ok ? { ok: true, kind: "xlsx" } : z;
  }
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    if (isZip || isOle || buf.subarray(0, 4096).includes(0)) return { ok: false, error: "This doesn't look like a CSV text file." };
    return { ok: true, kind: "csv" };
  }
  return { ok: false, error: "Upload an .xlsx or .csv file." };
}

// ───────────── value parsing ─────────────

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const normalizeDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).replace(/٫/g, ".").replace(/٬/g, ",");

/** Parses a plain decimal number ("1,299.50", "AED 1299", Arabic digits). Returns NaN for anything else. */
export function parseNumber(s: string): number {
  const t = normalizeDigits(s).replace(/AED|د\.إ/gi, "").replace(/[,\s]/g, "");
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}
export function parseIntStrict(s: string): number {
  const n = parseNumber(s);
  return Number.isInteger(n) ? n : NaN;
}
export const decimals = (n: number) => (String(n).split(".")[1] ?? "").length;

export const CONDITION_TYPES = ["NEW", "OPEN_BOX", "REFURBISHED", "USED", "PARTS"] as const;
export function normalizeConditionType(s: string): string | null {
  const k = s.toLowerCase().replace(/[^a-z؀-ۿ]/g, "");
  const map: Record<string, string> = {
    new: "NEW", brandnew: "NEW", sealed: "NEW", جديد: "NEW",
    openbox: "OPEN_BOX", openboxed: "OPEN_BOX", مفتوحةالعلبة: "OPEN_BOX",
    refurbished: "REFURBISHED", refurb: "REFURBISHED", renewed: "REFURBISHED", certifiedrefurbished: "REFURBISHED", مجدد: "REFURBISHED",
    used: "USED", preowned: "USED", secondhand: "USED", مستعمل: "USED",
    parts: "PARTS", partsonly: "PARTS", forparts: "PARTS", قطعغيار: "PARTS",
  };
  return map[k] ?? null;
}
export function normalizeWarrantyProvider(s: string): string | null {
  const k = s.toLowerCase().replace(/[^a-z]/g, "");
  const map: Record<string, string> = { seller: "SELLER", merchant: "SELLER", shop: "SELLER", manufacturer: "MANUFACTURER", brand: "MANUFACTURER", oem: "MANUFACTURER", none: "NONE", no: "NONE", nowarranty: "NONE", karat: "KARAT", platform: "KARAT", techrevive: "KARAT" };
  return map[k] ?? null;
}

// ───────────── photo URL safety (SSRF defence) ─────────────
// We never fetch these URLs server-side; we only store them. We still refuse anything that points inside a network,
// so a stored link can't later be used to probe internal services by a thumbnailer, crawler or admin tool.

export function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!h) return true;
  if (h.includes(":")) return true; // IPv6 literals are not accepted
  if (h === "localhost" || /\.(localhost|local|internal|lan|home|corp|intranet|test|invalid|example)$/.test(h)) return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
  }
  return !h.includes("."); // single-label names (intranet, metadata, …)
}

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;
/** Returns an error message, or null when the URL is acceptable. */
export function validatePhotoUrl(raw: string): string | null {
  if (raw.length > 500) return "photo link is too long (max 500 characters)";
  let u: URL;
  try { u = new URL(raw); } catch { return `"${raw.slice(0, 60)}" is not a valid link`; }
  if (u.protocol !== "https:") return `photo link must start with https:// ("${raw.slice(0, 40)}")`;
  if (u.username || u.password) return "photo links with a username or password are not allowed";
  if (u.port && u.port !== "443") return "photo links on custom ports are not allowed";
  if (isPrivateHost(u.hostname)) return `photo link host "${u.hostname}" is not allowed (local or private network address)`;
  if (!IMAGE_EXT.test(u.pathname)) return `photo link must point to an image file (.jpg .jpeg .png .webp .gif .avif): "${raw.slice(0, 60)}"`;
  return null;
}

// ───────────── shapes shared by the server actions and the wizard UI ─────────────

export type PreviewRow = { row: number; sku: string; handle: string; product?: string; title?: string; action: "create" | "update" | "unchanged" | "error"; messages: string[]; changes: string[]; review: boolean };
export type Counts = { total: number; create: number; update: number; unchanged: number; error: number; review: number };
export type AnalyzeResult =
  | { ok: true; token: string; filename: string; headers: string[]; sample: string[][]; rowCount: number; encoding: string; delimiter: string | null; format: "csv" | "xlsx"; mapping: Record<string, number>; remembered: boolean }
  | { ok: false; error: string };
export type PreviewResult = { ok: true; counts: Counts; missingRequired: string[]; rows: PreviewRow[]; shown: number } | { ok: false; error: string };
export type CommitResult = { ok: boolean; error?: string; summary?: { created: number; updated: number; unchanged: number; errors: number; skipped: number; sentForReview: number; mode: "partial" | "all_or_nothing"; durationMs: number }; errorCount?: number };

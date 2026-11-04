import "server-only";
import ExcelJS from "exceljs";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { adjustStock } from "./orders";
import { parseSpecs, parseValues, slugify } from "./format";

/** Shopify-style product sheet: one row per variant; rows sharing a Handle form one product. */
export const COLUMNS = [
  "Handle", "Title", "Title (Arabic)", "Vendor", "Type", "Category", "Tags", "Status", "Description", "Description (Arabic)",
  "Specs", "Image URLs", "Price New", "Featured", "Express",
  "Option1 Name", "Option1 Value", "Option2 Name", "Option2 Value", "Option3 Name", "Option3 Value",
  "Variant SKU", "Variant Price", "Variant Compare Price", "Variant Cost", "Variant Stock", "Variant Barcode", "Variant Weight",
  "Track Inventory", "Continue Selling", "SEO Title", "SEO Description",
] as const;
export type Row = Record<string, string>;
export const MAX_ROWS = 5000;

// ───────────── reading ─────────────

export async function parseFile(buf: Buffer, filename: string): Promise<Row[]> {
  const name = filename.toLowerCase();
  if (name.endsWith(".csv")) return rowsFromMatrix(parseCsv(buf.toString("utf8")));
  if (name.endsWith(".xlsx")) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    if (!ws) return [];
    const matrix: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const vals: string[] = [];
      for (let c = 1; c <= Math.max(row.cellCount, COLUMNS.length); c++) vals.push(cellText(row.getCell(c)));
      matrix.push(vals);
    });
    return rowsFromMatrix(matrix);
  }
  throw new Error("Unsupported file. Upload a .xlsx or .csv file.");
}

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value as unknown;
  if (v == null) return "";
  if (typeof v === "object") {
    const o = v as { richText?: { text: string }[]; text?: string; result?: unknown; hyperlink?: string };
    if (o.richText) return o.richText.map((r) => r.text).join("").trim();
    if (o.text != null) return String(o.text).trim();
    if (o.result != null) return String(o.result).trim();
    if (v instanceof Date) return v.toISOString();
  }
  return String(v).trim();
}

function rowsFromMatrix(m: string[][]): Row[] {
  if (!m.length) return [];
  const header = m[0].map((h) => h.replace(/^﻿/, "").trim());
  return m.slice(1)
    .filter((r) => r.some((c) => c && c.trim()))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// ───────────── validation ─────────────

export type ParsedVariant = {
  row: number; option1: string | null; option2: string | null; option3: string | null; sku: string | null; price: number;
  comparePrice: number | null; cost: number | null; stock: number; barcode: string | null; weight: number | null; trackInventory: boolean; continueSelling: boolean;
};
export type ParsedProduct = {
  handle: string; rows: number[]; exists: boolean; existingId?: string;
  title: string; titleAr: string; vendor: string; type: string; categoryId: string | null; categoryLabel: string; tags: string; status: string;
  description: string; descriptionAr: string; specs: Record<string, string>; images: string[]; priceNew: number | null;
  featured: boolean | null; express: boolean | null; seoTitle: string; seoDescription: string;
  options: { name: string; values: string[] }[]; variants: ParsedVariant[]; errors: string[];
};
export type ImportResult = { products: ParsedProduct[]; errors: { row: number; handle: string; message: string }[]; totalRows: number };

const truthy = (s: string) => /^(true|yes|y|1|✓)$/i.test(s.trim());
const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(/[, ]|AED/gi, "")));
const first = (rows: Row[], col: string) => rows.map((r) => r[col] ?? "").find((v) => v !== "") ?? "";

export async function validateRows(rows: Row[]): Promise<ImportResult> {
  const errors: ImportResult["errors"] = [];
  if (rows.length > MAX_ROWS) return { products: [], errors: [{ row: 0, handle: "", message: `Too many rows (max ${MAX_ROWS}).` }], totalRows: rows.length };
  const missing = rows.length ? ["Handle", "Variant Price"].filter((c) => !(c in rows[0])) : [];
  if (missing.length) return { products: [], errors: [{ row: 1, handle: "", message: `Missing required column(s): ${missing.join(", ")}. Download the template for the expected format.` }], totalRows: rows.length };

  const categories = await db.category.findMany();
  const findCat = (s: string) => {
    const k = s.trim().toLowerCase();
    return categories.find((c) => c.slug === k || c.name.toLowerCase() === k || c.nameAr === s.trim());
  };

  // group by handle (row numbers are spreadsheet rows: header = 1)
  const groups = new Map<string, { row: number; r: Row }[]>();
  rows.forEach((r, i) => {
    const handle = slugify(r["Handle"] || r["Title"] || "");
    if (!handle) { errors.push({ row: i + 2, handle: "", message: "Row has no Handle or Title." }); return; }
    if (!groups.has(handle)) groups.set(handle, []);
    groups.get(handle)!.push({ row: i + 2, r });
  });

  const handles = [...groups.keys()];
  const existing = await db.product.findMany({ where: { slug: { in: handles } }, select: { id: true, slug: true } });
  const fileSkus = new Map<string, string>();
  const products: ParsedProduct[] = [];

  for (const [handle, list] of groups) {
    const rs = list.map((x) => x.r);
    const ex = existing.find((e) => e.slug === handle);
    const p: ParsedProduct = {
      handle, rows: list.map((x) => x.row), exists: !!ex, existingId: ex?.id,
      title: first(rs, "Title"), titleAr: first(rs, "Title (Arabic)"), vendor: first(rs, "Vendor"), type: first(rs, "Type"),
      categoryId: null, categoryLabel: first(rs, "Category"), tags: first(rs, "Tags"), status: (first(rs, "Status") || "ACTIVE").toUpperCase(),
      description: first(rs, "Description"), descriptionAr: first(rs, "Description (Arabic)"),
      specs: Object.fromEntries(first(rs, "Specs").split(";").map((kv) => kv.split(":")).filter((a) => a.length >= 2 && a[0].trim()).map(([k, ...v]) => [k.trim(), v.join(":").trim()])),
      images: first(rs, "Image URLs").split("|").map((u) => u.trim()).filter(Boolean),
      priceNew: num(first(rs, "Price New")), featured: first(rs, "Featured") ? truthy(first(rs, "Featured")) : null,
      express: first(rs, "Express") ? truthy(first(rs, "Express")) : null, seoTitle: first(rs, "SEO Title"), seoDescription: first(rs, "SEO Description"),
      options: [], variants: [], errors: [],
    };
    const err = (row: number, m: string) => { p.errors.push(`Row ${row}: ${m}`); errors.push({ row, handle, message: m }); };

    if (!p.exists && !p.title) err(list[0].row, "Title is required for new products.");
    if (!["ACTIVE", "DRAFT", "ARCHIVED"].includes(p.status)) err(list[0].row, `Status must be ACTIVE, DRAFT or ARCHIVED (got "${p.status}").`);
    if (p.categoryLabel) {
      const c = findCat(p.categoryLabel);
      if (c) p.categoryId = c.id; else err(list[0].row, `Unknown category "${p.categoryLabel}". Use one of: ${categories.map((c) => c.slug).join(", ")}.`);
    } else if (!p.exists) err(list[0].row, "Category is required for new products.");
    if (p.priceNew != null && (Number.isNaN(p.priceNew) || p.priceNew < 0)) err(list[0].row, "Price New must be a number.");
    for (const u of p.images) if (!/^(https?:\/\/|\/)/.test(u)) err(list[0].row, `Invalid image URL "${u}".`);

    const names = [1, 2, 3].map((n) => first(rs, `Option${n} Name`));
    names.forEach((n, i) => { if (n && i > 0 && !names[i - 1]) err(list[0].row, `Option${i + 1} Name is set but Option${i} Name is empty.`); });
    const activeNames = names.filter(Boolean);
    const combos = new Set<string>();
    for (const { row, r } of list) {
      const vals = [1, 2, 3].map((n) => (r[`Option${n} Value`] ?? "").trim() || null);
      vals.forEach((v, i) => {
        if (v && !names[i]) err(row, `Option${i + 1} Value "${v}" has no Option${i + 1} Name.`);
        if (!v && names[i]) err(row, `Option${i + 1} Value is required (${names[i]}).`);
      });
      const key = vals.join("|");
      if (combos.has(key)) err(row, `Duplicate variant (${vals.filter(Boolean).join(" / ") || "Default Title"}).`);
      combos.add(key);
      const price = num(r["Variant Price"] ?? "");
      if (price == null || Number.isNaN(price) || price < 0) err(row, "Variant Price is required and must be a number ≥ 0.");
      const compare = num(r["Variant Compare Price"] ?? ""), cost = num(r["Variant Cost"] ?? ""), weight = num(r["Variant Weight"] ?? "");
      const stockN = num(r["Variant Stock"] ?? "");
      for (const [label, v] of [["Compare Price", compare], ["Cost", cost], ["Weight", weight], ["Stock", stockN]] as const)
        if (v != null && Number.isNaN(v)) err(row, `Variant ${label} must be a number.`);
      const sku = (r["Variant SKU"] ?? "").trim() || null;
      if (sku) {
        const prev = fileSkus.get(sku.toUpperCase());
        if (prev && prev !== handle + key) err(row, `SKU "${sku}" appears more than once in the file.`);
        fileSkus.set(sku.toUpperCase(), handle + key);
      }
      if (activeNames.length === 0 && list.length > 1 && row !== list[0].row) err(row, "Multiple rows for a product without options. Add Option1 Name/Value.");
      p.variants.push({
        row, option1: vals[0], option2: vals[1], option3: vals[2], sku, price: price ?? 0, comparePrice: compare, cost, weight,
        stock: Math.trunc(stockN ?? 0), barcode: (r["Variant Barcode"] ?? "").trim() || null,
        trackInventory: (r["Track Inventory"] ?? "") === "" ? true : truthy(r["Track Inventory"]),
        continueSelling: truthy(r["Continue Selling"] ?? ""),
      });
    }
    p.options = activeNames.map((name, i) => ({ name, values: [...new Set(p.variants.map((v) => [v.option1, v.option2, v.option3][i]).filter((x): x is string => !!x))] }));
    products.push(p);
  }

  // SKUs used by other products in the database
  const allSkus = products.flatMap((p) => p.variants.map((v) => v.sku).filter((s): s is string => !!s));
  if (allSkus.length) {
    const taken = await db.variant.findMany({ where: { sku: { in: allSkus } }, select: { sku: true, product: { select: { slug: true } } } });
    for (const t of taken) {
      const p = products.find((x) => x.variants.some((v) => v.sku === t.sku));
      if (p && t.product.slug !== p.handle) {
        const v = p.variants.find((x) => x.sku === t.sku)!;
        p.errors.push(`Row ${v.row}: SKU "${t.sku}" belongs to another product (${t.product.slug}).`);
        errors.push({ row: v.row, handle: p.handle, message: `SKU "${t.sku}" already belongs to product ${t.product.slug}.` });
      }
    }
  }
  return { products, errors: errors.sort((a, b) => a.row - b.row), totalRows: rows.length };
}

// ───────────── applying ─────────────

export async function applyImport(products: ParsedProduct[], mode: "update" | "skip", userId?: string) {
  let created = 0, updated = 0, skipped = 0, failed = 0;
  for (const p of products) {
    if (p.errors.length) { failed++; continue; }
    if (p.exists && mode === "skip") { skipped++; continue; }
    try {
      const data: Prisma.ProductUncheckedUpdateInput = {};
      if (p.title) data.name = p.title;
      if (p.titleAr) data.nameAr = p.titleAr;
      if (p.vendor) data.brand = p.vendor;
      if (p.type) data.productType = p.type;
      if (p.categoryId) data.categoryId = p.categoryId;
      if (p.tags) data.tags = p.tags;
      data.status = p.status;
      if (p.description) data.description = p.description;
      if (p.descriptionAr) data.descriptionAr = p.descriptionAr;
      if (Object.keys(p.specs).length) data.specs = JSON.stringify(p.specs);
      if (p.priceNew != null) data.priceNew = p.priceNew;
      if (p.featured != null) data.featured = p.featured;
      if (p.express != null) data.express = p.express;
      if (p.seoTitle) data.seoTitle = p.seoTitle;
      if (p.seoDescription) data.seoDescription = p.seoDescription;
      if (p.images.length) data.image = p.images[0];

      let productId = p.existingId;
      if (productId) {
        await db.product.update({ where: { id: productId }, data });
        updated++;
      } else {
        const c = await db.product.create({
          data: {
            slug: p.handle, name: p.title, brand: p.vendor || "Unbranded", categoryId: p.categoryId!,
            ...(data as Omit<Prisma.ProductUncheckedCreateInput, "slug" | "name" | "brand" | "categoryId">),
          },
        });
        productId = c.id;
        created++;
      }
      if (p.images.length) {
        await db.productImage.deleteMany({ where: { productId } });
        await db.productImage.createMany({ data: p.images.map((url, i) => ({ productId: productId!, url, alt: p.title, position: i })) });
      }
      await db.productOption.deleteMany({ where: { productId } });
      if (p.options.length)
        await db.productOption.createMany({ data: p.options.map((o, i) => ({ productId: productId!, name: o.name, position: i, values: JSON.stringify(o.values) })) });

      const existingVariants = await db.variant.findMany({ where: { productId } });
      const keep = new Set<string>();
      for (const [i, v] of p.variants.entries()) {
        const match =
          (v.sku && existingVariants.find((e) => e.sku === v.sku)) ||
          existingVariants.find((e) => !keep.has(e.id) && e.option1 === v.option1 && e.option2 === v.option2 && e.option3 === v.option3);
        const title = [v.option1, v.option2, v.option3].filter(Boolean).join(" / ") || "Default Title";
        const fields = {
          title, option1: v.option1, option2: v.option2, option3: v.option3, price: v.price, comparePrice: v.comparePrice, cost: v.cost,
          sku: v.sku, barcode: v.barcode, weight: v.weight, trackInventory: v.trackInventory, continueSelling: v.continueSelling, position: i,
        };
        if (match) {
          keep.add(match.id);
          await db.variant.update({ where: { id: match.id }, data: fields });
          if (v.stock !== match.stock) await adjustStock(match.id, v.stock - match.stock, "correction", userId, "Bulk import");
        } else {
          const nv = await db.variant.create({ data: { ...fields, productId: productId!, stock: 0 } });
          keep.add(nv.id);
          if (v.stock) await adjustStock(nv.id, v.stock, "received", userId, "Bulk import");
        }
      }
      const remove = existingVariants.filter((e) => !keep.has(e.id)).map((e) => e.id);
      if (remove.length) await db.variant.deleteMany({ where: { id: { in: remove } } });
    } catch (e) {
      failed++;
      p.errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return { created, updated, skipped, failed };
}

// ───────────── writing ─────────────

type ExportProduct = Prisma.ProductGetPayload<{ include: { variants: true; options: true; images: true; category: true } }>;

export function productsToRows(products: ExportProduct[]): Row[] {
  const rows: Row[] = [];
  for (const p of products) {
    const opts = [...p.options].sort((a, b) => a.position - b.position);
    const variants = [...p.variants].sort((a, b) => a.position - b.position);
    const specs = Object.entries(parseSpecs(p.specs)).map(([k, v]) => `${k}: ${v}`).join("; ");
    const images = [...p.images].sort((a, b) => a.position - b.position).map((i) => i.url);
    (variants.length ? variants : [null]).forEach((v, idx) => {
      const r: Row = Object.fromEntries(COLUMNS.map((c) => [c, ""]));
      r["Handle"] = p.slug;
      if (idx === 0) {
        Object.assign(r, {
          Title: p.name, "Title (Arabic)": p.nameAr, Vendor: p.brand, Type: p.productType, Category: p.category.slug, Tags: p.tags, Status: p.status,
          Description: p.description, "Description (Arabic)": p.descriptionAr, Specs: specs, "Image URLs": (images.length ? images : p.image ? [p.image] : []).join(" | "),
          "Price New": p.priceNew ? String(p.priceNew) : "", Featured: p.featured ? "TRUE" : "FALSE", Express: p.express ? "TRUE" : "FALSE",
          "SEO Title": p.seoTitle ?? "", "SEO Description": p.seoDescription ?? "",
        });
        opts.forEach((o, i) => (r[`Option${i + 1} Name`] = o.name));
      }
      if (v) {
        if (opts.length) [v.option1, v.option2, v.option3].forEach((val, i) => { if (opts[i]) { r[`Option${i + 1} Name`] = opts[i].name; r[`Option${i + 1} Value`] = val ?? ""; } });
        Object.assign(r, {
          "Variant SKU": v.sku ?? "", "Variant Price": String(v.price), "Variant Compare Price": v.comparePrice != null ? String(v.comparePrice) : "",
          "Variant Cost": v.cost != null ? String(v.cost) : "", "Variant Stock": String(v.stock), "Variant Barcode": v.barcode ?? "",
          "Variant Weight": v.weight != null ? String(v.weight) : "", "Track Inventory": v.trackInventory ? "TRUE" : "FALSE", "Continue Selling": v.continueSelling ? "TRUE" : "FALSE",
        });
      }
      rows.push(r);
    });
  }
  return rows;
}

export async function rowsToXlsx(rows: Row[], withGuide = false): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TechRevive Admin";
  const ws = wb.addWorksheet("Products", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = COLUMNS.map((c) => ({ header: c, key: c, width: ["Description", "Description (Arabic)", "Specs", "Image URLs"].includes(c) ? 40 : Math.max(12, c.length + 2) }));
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B1220" } };
  rows.forEach((r) => ws.addRow(r));
  if (withGuide) {
    const g = wb.addWorksheet("Instructions");
    g.columns = [{ header: "Column", key: "c", width: 24 }, { header: "How to fill it", key: "h", width: 100 }];
    g.getRow(1).font = { bold: true };
    GUIDE.forEach(([c, h]) => g.addRow({ c, h }));
    const cats = await db.category.findMany({ orderBy: { sortOrder: "asc" } });
    g.addRow({});
    g.addRow({ c: "Valid categories", h: cats.map((c) => `${c.slug} (${c.name})`).join(", ") });
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function rowsToCsv(rows: Row[]): string {
  const esc = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return "﻿" + [COLUMNS.join(","), ...rows.map((r) => COLUMNS.map((c) => esc(r[c] ?? "")).join(","))].join("\r\n");
}

export const TEMPLATE_ROWS: Row[] = [
  { Handle: "samsung-980-nvme-ssd", Title: "980 NVMe SSD", "Title (Arabic)": "قرص 980 NVMe", Vendor: "Samsung", Type: "SSD", Category: "storage", Tags: "nvme,ssd", Status: "ACTIVE",
    Description: "Fast PCIe 3.0 NVMe SSD.", "Description (Arabic)": "قرص NVMe سريع.", Specs: "Interface: PCIe 3.0 x4; Read Speed: 3500 MB/s", "Image URLs": "/img/storage.svg", "Price New": "399", Featured: "FALSE", Express: "TRUE",
    "Option1 Name": "Condition", "Option1 Value": "Brand New", "Option2 Name": "Capacity", "Option2 Value": "1TB", "Variant SKU": "SAM-980-NEW-1TB", "Variant Price": "349", "Variant Compare Price": "399",
    "Variant Cost": "250", "Variant Stock": "10", "Track Inventory": "TRUE", "Continue Selling": "FALSE", "SEO Title": "Samsung 980 NVMe SSD | Buy in UAE", "SEO Description": "Samsung 980 NVMe SSD with UAE warranty." },
  { Handle: "samsung-980-nvme-ssd", "Option1 Name": "Condition", "Option1 Value": "Excellent", "Option2 Name": "Capacity", "Option2 Value": "1TB", "Variant SKU": "SAM-980-EXC-1TB", "Variant Price": "249", "Variant Cost": "170", "Variant Stock": "4" },
  { Handle: "samsung-980-nvme-ssd", "Option1 Name": "Condition", "Option1 Value": "Excellent", "Option2 Name": "Capacity", "Option2 Value": "500GB", "Variant SKU": "SAM-980-EXC-500", "Variant Price": "169", "Variant Cost": "110", "Variant Stock": "6" },
  { Handle: "thermal-paste-mx-6", Title: "MX-6 Thermal Paste 4g", Vendor: "Arctic", Type: "Accessory", Category: "cooling", Status: "DRAFT", "Variant SKU": "ARC-MX6-4G", "Variant Price": "39", "Variant Stock": "50" },
].map((r) => Object.fromEntries(COLUMNS.map((c) => [c, (r as Row)[c] ?? ""])));

const GUIDE: [string, string][] = [
  ["Handle", "Required. Unique URL handle. All rows with the same handle belong to one product (one row per variant). Existing handles are updated."],
  ["Title", "Required for new products. Product-level columns only need to be filled on the first row of each product."],
  ["Category", "Required for new products. Category slug or name (see list below)."],
  ["Status", "ACTIVE (visible), DRAFT (hidden) or ARCHIVED. Default ACTIVE."],
  ["Specs", 'Key/value pairs separated by semicolons, e.g. "Memory: 12GB; TDP: 220W".'],
  ["Image URLs", 'One or more image URLs separated by "|". The first image is the main image.'],
  ["Option1..3 Name / Value", "Up to 3 options (e.g. Condition, Capacity, Color). Leave empty for a single-variant product."],
  ["Variant SKU", "Optional but recommended. Used to match existing variants on re-import."],
  ["Variant Price", "Required. Selling price in AED, VAT inclusive."],
  ["Variant Stock", "Available quantity. Changes are recorded in inventory history."],
  ["Track Inventory / Continue Selling", "TRUE or FALSE."],
  ["Note", "Variants of an existing product that are not in the file are removed on update. Export first to edit existing products safely."],
];

export async function loadExportProducts(where: Prisma.ProductWhereInput = {}) {
  return db.product.findMany({ where, include: { variants: true, options: true, images: true, category: true }, orderBy: { createdAt: "asc" } });
}

export { parseValues };

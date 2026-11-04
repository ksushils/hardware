"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSeller } from "@/lib/sellerAuth";
import { getSettings } from "@/lib/settings";
import { collectPhotos } from "@/lib/offerPhotos";
import { sendEmail, btn } from "@/lib/mailer";
import { siteUrl } from "@/lib/site";
import { parseValues } from "@/lib/format";
import { parseOfferTerms, termsChanged, termsData } from "@/lib/offerTerms";

type FormState = { error?: string; ok?: string } | undefined;

const offerSchema = z.object({
  productId: z.string().min(1),
  price: z.coerce.number().positive("Price must be greater than 0"),
  stock: z.coerce.number().int("Stock must be a whole number").min(0),
  sku: z.string().trim().max(60).default(""),
});

/**
 * Create or edit the current seller's OFFER (a Variant) on an approved canonical product.
 * Price/stock edits go live immediately; edits to condition, evidence, terms or photos send an approved offer back for review.
 */
export async function saveOffer(_: FormState, fd: FormData): Promise<FormState> {
  const { seller } = await requireSeller();
  const settings = await getSettings();
  const parsed = offerSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const id = String(fd.get("id") || "");

  const product = await db.product.findFirst({ where: { id: d.productId, status: "ACTIVE", approvalStatus: "APPROVED" }, include: { options: { orderBy: { position: "asc" } } } });
  if (!product) return { error: "That product isn't available for new offers." };
  const existing = id ? await db.variant.findFirst({ where: { id, sellerId: seller.id, productId: product.id } }) : null;
  if (id && !existing) return { error: "Offer not found." };

  // the option combination (the "specification") must be one the canonical product defines
  const vals: (string | null)[] = [null, null, null];
  for (const [i, o] of product.options.entries()) {
    const v = String(fd.get(`option${i + 1}`) || "").trim();
    if (!parseValues(o.values).includes(v)) return { error: `Choose a valid ${o.name}.` };
    vals[i] = v;
  }
  const title = vals.filter(Boolean).join(" / ") || "Default Title";
  const dupe = await db.variant.findFirst({
    where: { productId: product.id, sellerId: seller.id, option1: vals[0], option2: vals[1], option3: vals[2], ...(existing ? { id: { not: existing.id } } : {}) },
  });
  if (dupe) return { error: `You already have an offer for “${title}” on this product. Edit it instead.` };
  const sku = d.sku || null;
  if (sku) {
    const clash = await db.variant.findFirst({ where: { sku, ...(existing ? { id: { not: existing.id } } : {}) } });
    if (clash) return { error: `SKU ${sku} is already used. SKUs must be unique across the marketplace.` };
  }

  const tr = parseOfferTerms(fd, settings.returnsDays);
  if (!tr.ok) return { error: tr.error };
  const t = tr.terms;
  const ph = await collectPhotos(fd, `${seller.shopName}: ${product.name}`);
  if (ph.error) return { error: ph.error };
  const photos = ph.photos!;

  const comboChanged = !!existing && (existing.option1 !== vals[0] || existing.option2 !== vals[1] || existing.option3 !== vals[2]);
  const changed = !existing || comboChanged || termsChanged(existing, t, photos);
  const auto = settings.marketplace.autoApproveProducts;
  // any change to what the buyer is promised needs (re)approval; price/stock-only edits keep the current status
  const approvalStatus = !existing || changed ? (auto ? "APPROVED" : "PENDING") : existing.approvalStatus;
  // sellers can declare, never "verify": a platform verification only survives when the evidence is unchanged
  const verification = !existing ? (t.hasEvidence ? "SELLER_DECLARED" : "NONE") : changed ? (t.hasEvidence ? "SELLER_DECLARED" : "NONE") : existing.verification;

  const data = { ...termsData(t, photos), title, option1: vals[0], option2: vals[1], option3: vals[2], price: d.price, sku, verification, approvalStatus, rejectionReason: approvalStatus === "REJECTED" ? existing?.rejectionReason ?? null : null };
  let variantId: string;
  if (existing) {
    await db.variant.update({ where: { id: existing.id }, data: { ...data, stock: d.stock } });
    if (d.stock !== existing.stock) await db.inventoryAdjustment.create({ data: { variantId: existing.id, delta: d.stock - existing.stock, reason: "correction", note: `Seller ${seller.shopName}` } });
    variantId = existing.id;
  } else {
    const pos = await db.variant.count({ where: { productId: product.id } });
    const created = await db.variant.create({ data: { ...data, stock: d.stock, productId: product.id, sellerId: seller.id, position: pos } });
    if (d.stock) await db.inventoryAdjustment.create({ data: { variantId: created.id, delta: d.stock, reason: "received", note: `Seller ${seller.shopName}` } });
    variantId = created.id;
  }

  if (approvalStatus === "PENDING" && settings.notifications.staffEmail)
    await sendEmail(settings.notifications.staffEmail, `Offer awaiting approval: ${product.name} (${title})`, `<p>${seller.shopName} ${existing ? "changed their offer for" : "submitted an offer for"} <b>${product.name}</b> (${title}).</p>${btn(`${siteUrl()}/admin/sellers/products`, "Review offers")}`, "staff_offer_review");
  revalidatePath("/seller/products");
  revalidatePath(`/products/${product.slug}`);
  revalidatePath("/", "layout");
  void variantId;
  redirect(`/seller/products?saved=${approvalStatus === "PENDING" ? "OFFER_PENDING" : "OFFER_LIVE"}`);
}

/** Remove an offer. Offers that were already sold are retired (hidden, stock 0) so order history keeps its link. */
export async function deleteSellerOffer(fd: FormData) {
  const { seller } = await requireSeller();
  const v = await db.variant.findFirst({ where: { id: String(fd.get("id")), sellerId: seller.id }, include: { product: { select: { slug: true } } } });
  if (!v) return;
  const sold = await db.orderItem.count({ where: { variantId: v.id } });
  if (sold) await db.variant.update({ where: { id: v.id }, data: { approvalStatus: "DRAFT", stock: 0 } });
  else await db.variant.delete({ where: { id: v.id } });
  revalidatePath("/seller/products");
  revalidatePath(`/products/${v.product.slug}`);
  revalidatePath("/", "layout");
}

/** Inline price + stock update from the offers list. Always instant (no re-review). */
export async function updateOfferPriceStock(fd: FormData) {
  const { seller } = await requireSeller();
  const v = await db.variant.findFirst({ where: { id: String(fd.get("variantId")), sellerId: seller.id }, include: { product: { select: { slug: true } } } });
  if (!v) return;
  const stock = Math.max(0, Math.floor(Number(fd.get("stock"))));
  const price = Number(fd.get("price"));
  if (Number.isNaN(stock) || !(price > 0)) return;
  await db.variant.update({ where: { id: v.id }, data: { stock, price } });
  if (stock !== v.stock) await db.inventoryAdjustment.create({ data: { variantId: v.id, delta: stock - v.stock, reason: "correction", note: `Seller ${seller.shopName}` } });
  revalidatePath("/seller/products");
  revalidatePath(`/products/${v.product.slug}`);
}

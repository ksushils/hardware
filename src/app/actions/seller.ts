"use server";
import { postOrderPaidSafe } from "@/lib/ledgerPosting";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSeller } from "@/lib/sellerAuth";
import { getSettings } from "@/lib/settings";
import { saveUpload } from "@/lib/uploads";
import { sendEmail, btn } from "@/lib/mailer";
import { siteUrl } from "@/lib/site";
import { orderEvent } from "@/lib/activity";
import { creditSellerEarnings, sellerBalance } from "@/lib/marketplace";
import { slugify } from "@/lib/format";
import { parseOfferTerms, termsChanged, termsData } from "@/lib/offerTerms";
import { collectPhotos } from "@/lib/offerPhotos";

type FormState = { error?: string; ok?: string } | undefined;
type VariantIn = { option1: string | null; option2: string | null; option3: string | null; price: number; comparePrice: number | null; stock: number; sku: string };
type OptionIn = { name: string; nameAr: string; values: string[] };

const productSchema = z.object({
  name: z.string().trim().min(3, "Title is too short").max(150),
  nameAr: z.string().trim().max(150).default(""),
  description: z.string().trim().min(20, "Please write a description (at least 20 characters)"),
  descriptionAr: z.string().trim().default(""),
  categoryId: z.string().min(1, "Choose a category"),
  brand: z.string().trim().min(1, "Brand is required"),
  productType: z.string().trim().default(""),
  priceNew: z.coerce.number().min(0).default(0),
  tags: z.string().trim().default(""),
});

/**
 * Create or update a NEW product proposal owned by the current seller, together with the seller's own offers (variants) on it.
 * Content of an approved product that other sellers also sell is locked (only moderators change canonical content);
 * the seller can still edit their own offers on it.
 */
export async function saveSellerProduct(_: FormState, fd: FormData): Promise<FormState> {
  const { seller } = await requireSeller();
  const settings = await getSettings();
  const parsed = productSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (!(await db.category.findUnique({ where: { id: d.categoryId } }))) return { error: "Unknown category" };

  const id = String(fd.get("id") || "");
  const existing = id ? await db.product.findFirst({ where: { id, sellerId: seller.id }, include: { variants: true, options: true, images: true } }) : null;
  if (id && !existing) return { error: "Product not found" };
  const ownVariants = existing?.variants.filter((v) => v.sellerId === seller.id) ?? [];
  const others = existing ? existing.variants.some((v) => v.sellerId !== seller.id) : false;
  const locked = !!existing && existing.approvalStatus === "APPROVED" && others;

  let options: OptionIn[], variants: VariantIn[], specs: Record<string, string>, images: string[];
  try {
    options = locked
      ? existing!.options.sort((a, b) => a.position - b.position).map((o) => ({ name: o.name, nameAr: o.nameAr, values: JSON.parse(o.values) as string[] })).filter((o) => !(o.name === "Title" && o.values.length === 1 && o.values[0] === "Default Title"))
      : (JSON.parse(String(fd.get("options") || "[]")) as OptionIn[])
          .map((o) => ({ name: String(o.name).trim(), nameAr: String(o.nameAr ?? "").trim(), values: [...new Set((o.values ?? []).map((v) => String(v).trim()).filter(Boolean))] }))
          .filter((o) => o.name && o.values.length).slice(0, 3);
    variants = JSON.parse(String(fd.get("variants") || "[]"));
    specs = JSON.parse(String(fd.get("specs") || "{}"));
    images = (JSON.parse(String(fd.get("images") || "[]")) as string[]).filter((u) => typeof u === "string" && (u.startsWith("/") || u.startsWith("https://")));
  } catch {
    return { error: "Invalid form data" };
  }
  if (!locked)
    for (const f of fd.getAll("newImages")) {
      if (f instanceof File && f.size) {
        try { images.push((await saveUpload(f, d.name)).url); } catch (e) { return { error: e instanceof Error ? e.message : "Upload failed" }; }
      }
    }
  if (!locked && !images.length) return { error: "Add at least one product image" };
  if (!variants.length) return { error: "Add at least one variant with a price" };
  for (const v of variants) {
    if (!(Number(v.price) > 0)) return { error: "Every variant needs a price greater than 0" };
    if (!(Number.isInteger(Number(v.stock)) && Number(v.stock) >= 0)) return { error: "Stock must be a whole number" };
  }
  const skus = variants.map((v) => v.sku?.trim()).filter(Boolean);
  if (new Set(skus).size !== skus.length) return { error: "SKUs must be unique" };
  if (skus.length) {
    const own = new Set(ownVariants.map((v) => v.id));
    const clash = await db.variant.findFirst({ where: { sku: { in: skus as string[] }, id: { notIn: [...own] } } });
    if (clash) return { error: `SKU ${clash.sku} is already used by another offer` };
  }

  // condition / evidence / terms apply to every variant in this form (use "Edit offer" for per-variant differences)
  const tr = parseOfferTerms(fd, settings.returnsDays);
  if (!tr.ok) return { error: tr.error };
  const t = tr.terms;
  const ph = await collectPhotos(fd, `${seller.shopName}: ${d.name}`);
  if (ph.error) return { error: ph.error };
  const photos = ph.photos!;
  const auto = settings.marketplace.autoApproveProducts;

  // content changes on an approved product send it back for review; price/stock/terms-only edits don't touch the product
  const contentKey = (p: { name: string; nameAr: string; description: string; descriptionAr: string; categoryId: string; brand: string; productType: string; specs: string }, imgs: string[], opts: OptionIn[]) =>
    JSON.stringify([p.name, p.nameAr, p.description, p.descriptionAr, p.categoryId, p.brand, p.productType, p.specs, imgs, opts.map((o) => [o.name, o.values])]);
  const specsJson = JSON.stringify(specs);
  const newKey = contentKey({ ...d, specs: specsJson }, images, options);
  const oldKey = existing ? contentKey(existing, existing.images.sort((a, b) => a.position - b.position).map((i) => i.url), existing.options.sort((a, b) => a.position - b.position).map((o) => ({ name: o.name, nameAr: o.nameAr, values: JSON.parse(o.values) }))) : "";
  const needsReview = !locked && (!existing || newKey !== oldKey || existing.approvalStatus !== "APPROVED");
  const productStatus = !needsReview ? "APPROVED" : auto ? "APPROVED" : fd.get("draft") === "1" ? "DRAFT" : "PENDING";

  const base = {
    name: d.name, nameAr: d.nameAr, description: d.description, descriptionAr: d.descriptionAr, categoryId: d.categoryId, brand: d.brand,
    productType: d.productType, priceNew: d.priceNew, tags: d.tags, specs: specsJson, image: images[0], approvalStatus: productStatus,
    rejectionReason: needsReview ? null : existing?.rejectionReason ?? null, status: "ACTIVE",
  };
  const product = locked
    ? existing!
    : existing
      ? await db.product.update({ where: { id: existing.id }, data: base })
      : await db.product.create({ data: { ...base, sellerId: seller.id, slug: `${slugify(`${d.brand} ${d.name}`)}-${Math.random().toString(36).slice(2, 6)}` } });

  if (!locked) {
    await db.productImage.deleteMany({ where: { productId: product.id } });
    await db.productImage.createMany({ data: images.map((url, i) => ({ productId: product.id, url, alt: d.name, position: i })) });
    await db.productOption.deleteMany({ where: { productId: product.id } });
    const opts = options.length ? options : [{ name: "Title", nameAr: "", values: ["Default Title"] }];
    await db.productOption.createMany({ data: opts.map((o, i) => ({ productId: product.id, name: o.name, nameAr: o.nameAr, position: i, values: JSON.stringify(o.values) })) });
  }

  const keyOf = (v: { option1: string | null; option2: string | null; option3: string | null }) => [v.option1, v.option2, v.option3].map((x) => x ?? "").join("|");
  const keep = new Set<string>();
  const tdata = termsData(t, photos);
  for (const [i, raw] of variants.entries()) {
    const v = { option1: options.length ? raw.option1 : "Default Title", option2: options.length > 1 ? raw.option2 : null, option3: options.length > 2 ? raw.option3 : null };
    const title = options.length ? [v.option1, v.option2, v.option3].filter(Boolean).join(" / ") : "Default Title";
    const data = { ...v, title, price: Number(raw.price), comparePrice: raw.comparePrice ? Number(raw.comparePrice) : null, sku: raw.sku?.trim() || null, position: i };
    const match = ownVariants.find((o) => keyOf(o) === keyOf(v));
    const stock = Number(raw.stock);
    if (match) {
      keep.add(match.id);
      const changed = termsChanged(match, t, photos);
      const status = changed && match.approvalStatus !== "DRAFT" ? (auto ? "APPROVED" : "PENDING") : match.approvalStatus;
      await db.variant.update({ where: { id: match.id }, data: { ...data, ...tdata, stock, approvalStatus: status, verification: changed ? (t.hasEvidence ? "SELLER_DECLARED" : "NONE") : match.verification } });
      if (stock !== match.stock) await db.inventoryAdjustment.create({ data: { variantId: match.id, delta: stock - match.stock, reason: "correction", note: `Seller ${seller.shopName}` } });
    } else {
      const status = locked ? (auto ? "APPROVED" : "PENDING") : productStatus;
      const created = await db.variant.create({ data: { ...data, ...tdata, stock, productId: product.id, sellerId: seller.id, approvalStatus: status, verification: t.hasEvidence ? "SELLER_DECLARED" : "NONE" } });
      keep.add(created.id);
      if (stock) await db.inventoryAdjustment.create({ data: { variantId: created.id, delta: stock, reason: "received", note: `Seller ${seller.shopName}` } });
    }
  }
  // only this seller's own offers can be removed here, never other sellers' or the store's
  await db.variant.deleteMany({ where: { productId: product.id, sellerId: seller.id, id: { notIn: [...keep] } } });

  const pendingSomething = productStatus === "PENDING" || (!!existing && (await db.variant.count({ where: { productId: product.id, sellerId: seller.id, approvalStatus: "PENDING" } })) > 0);
  if (pendingSomething && settings.notifications.staffEmail)
    await sendEmail(settings.notifications.staffEmail, `Marketplace approval needed: ${d.name}`, `<p>${seller.shopName} submitted <b>${d.name}</b> for review.</p>${btn(`${siteUrl()}/admin/sellers/products`, "Review")}`, "staff_product_review");
  revalidatePath("/seller/products");
  revalidatePath("/", "layout");
  redirect(`/seller/products?saved=${locked ? "OFFER_PENDING" : productStatus}`);
}

/** Delete a product proposal. Other sellers' and the store's offers are never touched; sold offers are retired instead. */
export async function deleteSellerProduct(fd: FormData) {
  const { seller } = await requireSeller();
  const id = String(fd.get("id"));
  const p = await db.product.findFirst({ where: { id, sellerId: seller.id }, include: { variants: true } });
  if (!p) return;
  const sold = await db.orderItem.count({ where: { productId: id } });
  const othersOffer = p.variants.some((v) => v.sellerId !== seller.id);
  if (othersOffer) {
    // keep the shared product for the other sellers; remove only this seller's unsold offers (retire sold ones)
    for (const v of p.variants.filter((x) => x.sellerId === seller.id)) {
      if (await db.orderItem.count({ where: { variantId: v.id } })) await db.variant.update({ where: { id: v.id }, data: { approvalStatus: "DRAFT", stock: 0 } });
      else await db.variant.delete({ where: { id: v.id } });
    }
  } else if (sold) await db.product.update({ where: { id }, data: { status: "ARCHIVED" } });
  else await db.product.delete({ where: { id } });
  revalidatePath("/seller/products");
  revalidatePath("/", "layout");
}

/** Quick inline stock update from the products list. */
export async function updateSellerStock(fd: FormData) {
  const { seller } = await requireSeller();
  const variantId = String(fd.get("variantId"));
  const stock = Math.max(0, Math.floor(Number(fd.get("stock"))));
  const v = await db.variant.findFirst({ where: { id: variantId, sellerId: seller.id } });
  if (!v || Number.isNaN(stock)) return;
  await db.variant.update({ where: { id: v.id }, data: { stock } });
  if (stock !== v.stock) await db.inventoryAdjustment.create({ data: { variantId: v.id, delta: stock - v.stock, reason: "correction", note: `Seller ${seller.shopName}` } });
  revalidatePath("/seller/products");
}

const FLOW: Record<string, string[]> = { PENDING: ["PROCESSING", "SHIPPED"], PROCESSING: ["SHIPPED"], SHIPPED: ["DELIVERED"] };

export async function updateSellerOrder(fd: FormData) {
  const { seller } = await requireSeller();
  const id = String(fd.get("id"));
  const status = String(fd.get("status"));
  const so = await db.sellerOrder.findFirst({ where: { id, sellerId: seller.id }, include: { order: true } });
  if (!so) return;
  if (!(FLOW[so.status] ?? []).includes(status)) redirect(`/seller/orders/${id}?error=transition`);
  if (so.order.status === "CANCELLED") redirect(`/seller/orders/${id}?error=cancelled`);
  const data: Record<string, unknown> = { status };
  if (status === "SHIPPED") {
    const trackingNumber = String(fd.get("trackingNumber") || "").trim();
    if (!trackingNumber) redirect(`/seller/orders/${id}?error=tracking`);
    Object.assign(data, { trackingCompany: String(fd.get("trackingCompany") || "").trim() || null, trackingNumber, shippedAt: new Date() });
  }
  if (status === "DELIVERED") data.deliveredAt = new Date();
  await db.sellerOrder.update({ where: { id }, data });
  await orderEvent(so.orderId, status === "DELIVERED" ? "delivered" : "fulfilled", `${seller.shopName} marked their items ${status.toLowerCase()}${data.trackingNumber ? ` (tracking ${data.trackingCompany ?? ""} ${data.trackingNumber})` : ""}.`);
  if (status === "DELIVERED") await creditSellerEarnings(id);
  // when every seller sub-order is shipped/delivered and there are no store-owned items, reflect it on the main order
  const order = await db.order.findUnique({ where: { id: so.orderId }, include: { items: true, sellerOrders: true } });
  if (order && order.items.every((i) => i.sellerId)) {
    const all = order.sellerOrders.filter((x) => x.status !== "CANCELLED");
    if (all.every((x) => x.status === "DELIVERED") && order.fulfillmentStatus !== "DELIVERED")
    {
      const codPaid = order.paymentMethod === "COD" && order.paymentStatus === "PENDING";
      await db.order.update({ where: { id: order.id }, data: { fulfillmentStatus: "DELIVERED", deliveredAt: new Date(), ...(codPaid ? { paymentStatus: "PAID", paidAt: new Date() } : {}) } });
      if (codPaid) await postOrderPaidSafe(order.id); // double-entry ledger: cash collected on delivery
    }
    else if (all.every((x) => ["SHIPPED", "DELIVERED"].includes(x.status)) && order.fulfillmentStatus === "UNFULFILLED")
      await db.order.update({ where: { id: order.id }, data: { fulfillmentStatus: "FULFILLED", fulfilledAt: new Date() } });
  }
  const s = await getSettings();
  if (s.notifications.staffEmail) await sendEmail(s.notifications.staffEmail, `[Marketplace] ${seller.shopName}: order ${so.order.number} → ${status}`, `<p>${seller.shopName} updated sub-order for order ${so.order.number} to <b>${status}</b>.</p>`, "staff_seller_order");
  revalidatePath(`/seller/orders/${id}`);
  redirect(`/seller/orders/${id}?ok=1`);
}

export async function requestPayout(_: FormState, fd: FormData): Promise<FormState> {
  const { seller } = await requireSeller();
  const s = await getSettings();
  const amount = Math.round(Number(fd.get("amount")) * 100) / 100;
  const bal = await sellerBalance(seller.id);
  if (!seller.iban) return { error: "Add your bank IBAN in Shop settings first." };
  if (!(amount >= s.marketplace.minPayout)) return { error: `Minimum withdrawal is AED ${s.marketplace.minPayout}.` };
  if (amount > bal.available) return { error: `You can withdraw at most AED ${bal.available}.` };
  await db.payout.create({ data: { sellerId: seller.id, amount, method: "BANK_TRANSFER" } });
  if (s.notifications.staffEmail) await sendEmail(s.notifications.staffEmail, `Payout request: ${seller.shopName} AED ${amount}`, `<p>${seller.shopName} requested a payout of AED ${amount}.</p>${btn(`${siteUrl()}/admin/sellers/payouts`, "Process payouts")}`, "staff_payout_request");
  revalidatePath("/seller/payouts");
  return { ok: `Withdrawal of AED ${amount} requested.` };
}

export async function replySellerMessage(_: FormState, fd: FormData): Promise<FormState> {
  const { seller } = await requireSeller();
  const id = String(fd.get("id"));
  const reply = String(fd.get("reply") || "").trim();
  if (reply.length < 2) return { error: "Write a reply" };
  const m = await db.sellerMessage.findFirst({ where: { id, sellerId: seller.id } });
  if (!m) return { error: "Message not found" };
  await db.sellerMessage.update({ where: { id }, data: { reply, repliedAt: new Date(), readAt: m.readAt ?? new Date() } });
  await sendEmail(m.fromEmail, `Re: ${m.subject}`, `<p>${seller.shopName} replied to your message:</p><blockquote>${reply.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</blockquote><p style="color:#64748b">Your message: ${m.body.replace(/</g, "&lt;").slice(0, 500)}</p>${btn(`${siteUrl()}/sellers/${seller.slug}`, `Visit ${seller.shopName}`)}`, "seller_message_reply");
  revalidatePath("/seller/messages");
  return { ok: "Reply sent." };
}

export async function updateShopSettings(_: FormState, fd: FormData): Promise<FormState> {
  const { seller } = await requireSeller();
  const parsed = z.object({
    shopName: z.string().trim().min(3).max(60),
    email: z.string().trim().toLowerCase().email(),
    phone: z.string().trim().min(8),
    address: z.string().trim().default(""),
    about: z.string().trim().max(3000).default(""),
    aboutAr: z.string().trim().max(3000).default(""),
    returnPolicy: z.string().trim().max(3000).default(""),
    shippingPolicy: z.string().trim().max(3000).default(""),
    bankName: z.string().trim().default(""),
    accountName: z.string().trim().default(""),
    iban: z.string().trim().regex(/^AE\d{21}$/i, "IBAN must start with AE and be 23 characters").or(z.literal("")),
    flatShippingFee: z.coerce.number().min(0).default(0),
    vacationMessage: z.string().trim().max(300).default(""),
    vacationUntil: z.string().default(""),
  }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: `${parsed.error.issues[0].path.join(".")}: ${parsed.error.issues[0].message}` };
  const d = parsed.data;
  let logoUrl = seller.logoUrl, bannerUrl = seller.bannerUrl;
  try {
    const logo = fd.get("logo"), banner = fd.get("banner");
    if (logo instanceof File && logo.size) logoUrl = (await saveUpload(logo, `${d.shopName} logo`)).url;
    if (banner instanceof File && banner.size) bannerUrl = (await saveUpload(banner, `${d.shopName} banner`)).url;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Upload failed" };
  }
  const social: Record<string, string> = {};
  for (const k of ["instagram", "facebook", "x", "tiktok", "website"]) {
    const v = String(fd.get(`social_${k}`) || "").trim();
    if (v.startsWith("https://")) social[k] = v;
  }
  await db.seller.update({
    where: { id: seller.id },
    data: {
      shopName: d.shopName, email: d.email, phone: d.phone, address: d.address, about: d.about, aboutAr: d.aboutAr,
      returnPolicy: d.returnPolicy, shippingPolicy: d.shippingPolicy, bankName: d.bankName || null, accountName: d.accountName || null,
      iban: d.iban ? d.iban.toUpperCase() : null, flatShippingFee: d.flatShippingFee, freeShippingOver: fd.get("freeShippingOver") ? Number(fd.get("freeShippingOver")) : null,
      vacationMode: fd.get("vacationMode") === "on", vacationMessage: d.vacationMessage || null, vacationUntil: d.vacationUntil ? new Date(d.vacationUntil) : null,
      logoUrl, bannerUrl, social: JSON.stringify(social),
    },
  });
  revalidatePath("/seller/settings");
  revalidatePath(`/sellers/${seller.slug}`);
  return { ok: "Shop settings saved." };
}

export async function markMessageRead(fd: FormData) {
  const { seller } = await requireSeller();
  await db.sellerMessage.updateMany({ where: { id: String(fd.get("id")), sellerId: seller.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/seller/messages");
}

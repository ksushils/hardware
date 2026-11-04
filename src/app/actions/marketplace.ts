"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { saveUpload } from "@/lib/uploads";
import { sendEmail, btn } from "@/lib/mailer";
import { siteUrl } from "@/lib/site";
import { logActivity } from "@/lib/activity";
import { EMIRATES } from "@/lib/format";
import { RESERVED_SLUGS, recomputeSellerRating, slugifyShop } from "@/lib/marketplace";

type FormState = { error?: string; ok?: string } | undefined;

/** Live slug availability check for the application form. */
export async function checkShopSlug(raw: string): Promise<{ slug: string; available: boolean }> {
  const slug = slugifyShop(raw);
  if (slug.length < 3 || RESERVED_SLUGS.includes(slug)) return { slug, available: false };
  const exists = await db.seller.findUnique({ where: { slug } });
  return { slug, available: !exists };
}

export async function applyAsSeller(_: FormState, fd: FormData): Promise<FormState> {
  const { locale } = await getI18n();
  const ar = locale === "ar";
  const user = await getUser();
  if (!user) redirect("/login?next=/become-a-seller/apply");
  if (await db.seller.findUnique({ where: { userId: user.id } })) redirect("/seller");
  const s = await getSettings();
  if (!s.marketplace.enabled) return { error: ar ? "التسجيل كبائع غير متاح حاليًا." : "Seller registration is currently closed." };

  const schema = z.object({
    shopName: z.string().trim().min(3, ar ? "اسم المتجر قصير جدًا" : "Shop name is too short").max(60),
    slug: z.string().trim().min(3, ar ? "رابط المتجر قصير جدًا" : "Shop URL is too short"),
    email: z.string().trim().toLowerCase().email(ar ? "بريد غير صالح" : "Enter a valid email"),
    phone: z.string().trim().regex(/^(\+971|0)?\d{8,9}$/, ar ? "رقم هاتف إماراتي غير صالح" : "Enter a valid UAE phone number"),
    emirate: z.enum(EMIRATES as [string, ...string[]]),
    address: z.string().trim().min(5, ar ? "العنوان مطلوب" : "Address is required"),
    trn: z.string().trim().regex(/^\d{15}$/, ar ? "رقم التسجيل الضريبي يجب أن يكون 15 رقمًا" : "TRN must be 15 digits").or(z.literal("")),
    tradeLicenseNo: z.string().trim().min(3, ar ? "رقم الرخصة التجارية مطلوب" : "Trade licence number is required"),
    tradeLicenseExpiry: z.string().min(8, ar ? "تاريخ انتهاء الرخصة مطلوب" : "Licence expiry date is required"),
    about: z.string().trim().max(2000).optional(),
    bankName: z.string().trim().optional(),
    accountName: z.string().trim().optional(),
    iban: z.string().trim().regex(/^AE\d{21}$/i, ar ? "رقم الآيبان يجب أن يبدأ بـ AE ويتكون من 23 حرفًا" : "IBAN must start with AE and be 23 characters").or(z.literal("")),
  });
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (fd.get("terms") !== "on") return { error: ar ? "يجب الموافقة على شروط البائع" : "Please accept the seller terms" };
  const d = parsed.data;
  const expiry = new Date(d.tradeLicenseExpiry);
  if (Number.isNaN(+expiry) || expiry < new Date()) return { error: ar ? "الرخصة التجارية منتهية" : "Your trade licence has expired" };
  const { slug, available } = await checkShopSlug(d.slug);
  if (!available) return { error: ar ? "رابط المتجر غير متاح" : "That shop URL is taken. Try another." };

  let tradeLicenseUrl: string | undefined;
  const file = fd.get("tradeLicense");
  if (file instanceof File && file.size) {
    if (!["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(file.type)) return { error: ar ? "ارفع الرخصة بصيغة صورة أو PDF" : "Upload the licence as an image or PDF" };
    try {
      // PDFs aren't in saveUpload's allow-list; store images via the media library, PDFs directly
      if (file.type === "application/pdf") tradeLicenseUrl = await savePdf(file);
      else tradeLicenseUrl = (await saveUpload(file, `Trade licence – ${d.shopName}`)).url;
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Upload failed" };
    }
  }

  const status = s.marketplace.autoApproveSellers ? "APPROVED" : "PENDING";
  const seller = await db.seller.create({
    data: {
      userId: user.id, shopName: d.shopName, slug, status, email: d.email, phone: d.phone, emirate: d.emirate, address: d.address,
      trn: d.trn || null, tradeLicenseNo: d.tradeLicenseNo, tradeLicenseExpiry: expiry, tradeLicenseUrl, about: d.about ?? "",
      bankName: d.bankName || null, accountName: d.accountName || null, iban: d.iban ? d.iban.toUpperCase() : null,
      approvedAt: status === "APPROVED" ? new Date() : null,
    },
  });
  await logActivity({ id: user.id, name: user.name }, "applied", "seller", `Seller application: ${seller.shopName}`, seller.id);
  await sendEmail(
    d.email,
    ar ? "استلمنا طلبك للبيع على تك ريفايف" : `We received your seller application for ${d.shopName}`,
    status === "APPROVED"
      ? `<p>${ar ? "تمت الموافقة على متجرك! ابدأ بإضافة منتجاتك." : "Your shop is approved! Start adding products."}</p>${btn(`${siteUrl()}/seller`, ar ? "لوحة البائع" : "Open seller portal")}`
      : `<p>${ar ? "شكرًا لتقديمك. سيراجع فريقنا طلبك خلال يومي عمل." : "Thanks for applying. Our team will review your application within 2 business days."}</p>`,
    "seller_application",
  );
  if (s.notifications.staffEmail)
    await sendEmail(s.notifications.staffEmail, `New seller application: ${d.shopName}`, `<p>${d.shopName} (${d.email}, ${d.emirate}) applied to sell on the marketplace.</p>${btn(`${siteUrl()}/admin/sellers/${seller.id}`, "Review application")}`, "staff_seller_application");
  redirect(status === "APPROVED" ? "/seller" : "/seller/status");
}

async function savePdf(file: File) {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const path = await import("node:path");
  if (file.size > 10 * 1024 * 1024) throw new Error("File too large (max 10MB)");
  const name = `${Date.now().toString(36)}-licence.pdf`;
  const dir = path.join(process.cwd(), "public", "uploads", "docs");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return `/uploads/docs/${name}`;
}

/** "Contact seller" form on the shop/product page. */
export async function contactSeller(_: FormState, fd: FormData): Promise<FormState> {
  const { locale } = await getI18n();
  const ar = locale === "ar";
  const user = await getUser();
  const sellerId = String(fd.get("sellerId") || "");
  const seller = await db.seller.findUnique({ where: { id: sellerId } });
  if (!seller || seller.status !== "APPROVED") return { error: "Seller not found" };
  const parsed = z.object({
    fromName: z.string().trim().min(2, ar ? "الاسم مطلوب" : "Name is required"),
    fromEmail: z.string().trim().toLowerCase().email(ar ? "بريد غير صالح" : "Enter a valid email"),
    subject: z.string().trim().min(3, ar ? "الموضوع مطلوب" : "Subject is required").max(120),
    body: z.string().trim().min(10, ar ? "الرسالة قصيرة جدًا" : "Message is too short").max(3000),
  }).safeParse({ fromName: fd.get("fromName") ?? user?.name, fromEmail: fd.get("fromEmail") ?? user?.email, subject: fd.get("subject"), body: fd.get("body") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  // simple honeypot for guests
  if (fd.get("website")) return { ok: ar ? "تم إرسال رسالتك." : "Message sent." };
  const productId = String(fd.get("productId") || "") || null;
  await db.sellerMessage.create({ data: { sellerId, ...parsed.data, userId: user?.id, productId } });
  await sendEmail(seller.email, `New message from a customer: ${parsed.data.subject}`,
    `<p><b>${esc(parsed.data.fromName)}</b> (${esc(parsed.data.fromEmail)}) wrote:</p><blockquote>${esc(parsed.data.body).replace(/\n/g, "<br>")}</blockquote>${btn(`${siteUrl()}/seller/messages`, "Reply in seller portal")}`, "seller_message");
  return { ok: ar ? "تم إرسال رسالتك إلى البائع." : "Your message was sent to the seller." };
}

/** Buyer rates a seller — only customers with a delivered sub-order from this seller. */
export async function rateSeller(_: FormState, fd: FormData): Promise<FormState> {
  const { locale } = await getI18n();
  const ar = locale === "ar";
  const user = await getUser();
  if (!user) return { error: ar ? "سجّل الدخول لتقييم البائع" : "Log in to rate this seller" };
  const sellerId = String(fd.get("sellerId") || "");
  const rating = Number(fd.get("rating"));
  const comment = String(fd.get("comment") || "").trim();
  if (!(rating >= 1 && rating <= 5)) return { error: ar ? "اختر التقييم" : "Choose a rating" };
  if (comment.length < 5) return { error: ar ? "اكتب تعليقًا قصيرًا" : "Write a short comment" };
  const so = await db.sellerOrder.findFirst({ where: { sellerId, status: "DELIVERED", order: { OR: [{ userId: user.id }, { email: user.email }] } }, include: { order: true } });
  if (!so) return { error: ar ? "يمكنك التقييم بعد استلام طلب من هذا البائع" : "You can rate this seller after receiving an order from them" };
  await db.sellerReview.upsert({
    where: { sellerId_userId: { sellerId, userId: user.id } },
    update: { rating, comment, status: "PUBLISHED" },
    create: { sellerId, userId: user.id, orderId: so.orderId, rating, comment },
  });
  await recomputeSellerRating(sellerId);
  revalidatePath("/sellers/[slug]", "page");
  return { ok: ar ? "شكرًا لتقييمك!" : "Thanks for your rating!" };
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

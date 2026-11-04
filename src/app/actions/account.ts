"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getUser, hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { getI18n } from "@/lib/i18n";
import { EMIRATES } from "@/lib/format";
import { canViewOrder } from "@/lib/orders";
import { orderEvent, logActivity } from "@/lib/activity";
import { limitByIp } from "@/lib/rateLimit";
import type { FormState } from "./auth";

export async function toggleWishlist(formData: FormData) {
  const productId = String(formData.get("productId") || "");
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(String(formData.get("path") || "/"))}`);
  const key = { userId_productId: { userId: user.id, productId } };
  const existing = await db.wishlistItem.findUnique({ where: key });
  if (existing) await db.wishlistItem.delete({ where: key });
  else await db.wishlistItem.create({ data: { userId: user.id, productId } });
  revalidatePath("/", "layout");
}

export async function saveAddress(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/account/addresses");
  const { t } = await getI18n();
  const schema = z.object({
    fullName: z.string().trim().min(2, t.auth.errors.name),
    phone: z.string().trim().regex(/^(\+971|0)?5\d{8}$/, t.auth.errors.phone),
    emirate: z.enum(EMIRATES as [string, ...string[]]),
    area: z.string().trim().min(2, t.checkout.area),
    street: z.string().trim().min(2, t.checkout.street),
    building: z.string().trim().min(1, t.checkout.building),
  });
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const count = await db.address.count({ where: { userId: user.id } });
  await db.address.create({ data: { ...parsed.data, userId: user.id, isDefault: count === 0 } });
  revalidatePath("/account/addresses");
  return { ok: t.account.addressSaved };
}

export async function deleteAddress(formData: FormData) {
  const user = await requireUser();
  await db.address.deleteMany({ where: { id: String(formData.get("id")), userId: user.id } });
  revalidatePath("/account/addresses");
}

export async function setDefaultAddress(formData: FormData) {
  const user = await requireUser();
  await db.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
  await db.address.updateMany({ where: { id: String(formData.get("id")), userId: user.id }, data: { isDefault: true } });
  revalidatePath("/account/addresses");
}

export async function updateProfile(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const { t } = await getI18n();
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const locale = formData.get("locale") === "ar" ? "ar" : "en";
  if (name.length < 2) return { error: t.account.errors.shortName };
  await db.user.update({ where: { id: user.id }, data: { name, phone: phone || null, locale, acceptsMarketing: formData.get("marketing") === "on" } });
  const current = String(formData.get("currentPassword") || "");
  const next = String(formData.get("newPassword") || "");
  if (next) {
    const full = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!(await verifyPassword(current, full.password))) return { error: t.account.errors.wrongPassword };
    if (next.length < 8) return { error: t.account.errors.shortPassword };
    await db.user.update({ where: { id: user.id }, data: { password: await hashPassword(next) } });
  }
  revalidatePath("/account");
  return { ok: t.account.profileUpdated };
}

export async function submitReview(_: FormState, formData: FormData): Promise<FormState> {
  const user = await getUser();
  const { t, locale } = await getI18n();
  if (!user) return { error: t.product.loginToReview };
  const productId = String(formData.get("productId"));
  const rating = Number(formData.get("rating"));
  const comment = String(formData.get("comment") || "").trim();
  if (!(rating >= 1 && rating <= 5)) return { error: locale === "ar" ? "يرجى اختيار التقييم." : "Please choose a rating." };
  if (comment.length < 5) return { error: locale === "ar" ? "يرجى كتابة تعليق قصير." : "Please write a short comment." };
  // Verified-purchase reviews only: the reviewer must have a paid (or delivered COD), non-cancelled order containing this product.
  const bought = await db.orderItem.findFirst({
    where: { productId, order: { userId: user.id, status: { notIn: ["CANCELLED", "DRAFT"] }, OR: [{ paymentStatus: "PAID" }, { fulfillmentStatus: "DELIVERED" }] } },
    select: { id: true },
  });
  if (!bought) return { error: locale === "ar" ? "يمكن فقط للمشترين كتابة تقييم لهذا المنتج." : "Only customers who bought this product can review it." };
  await db.review.upsert({
    where: { productId_userId: { productId, userId: user.id } },
    update: { rating, comment, status: "PUBLISHED", verified: true },
    create: { productId, userId: user.id, rating, comment, verified: true },
  });
  revalidatePath("/products/[slug]", "page");
  return { ok: locale === "ar" ? "شكرًا لتقييمك!" : "Thanks for your review!" };
}

export async function subscribeNewsletter(_: FormState, formData: FormData): Promise<FormState> {
  const { locale } = await getI18n();
  if (!(await limitByIp("newsletter", 10, 3600))) return { error: locale === "ar" ? "محاولات كثيرة." : "Too many attempts." };
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) return { error: locale === "ar" ? "بريد غير صالح" : "Invalid email" };
  await db.subscriber.upsert({ where: { email }, update: {}, create: { email, locale, source: String(formData.get("source") || "footer") } });
  await db.user.updateMany({ where: { email }, data: { acceptsMarketing: true } });
  return { ok: "subscribed" };
}

export async function requestStockAlert(_: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getI18n();
  if (!(await limitByIp("stockalert", 10, 3600))) return { error: "Too many attempts." };
  const variantId = String(formData.get("variantId") || "");
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) return { error: t.auth.errors.email };
  await db.stockAlert.upsert({ where: { variantId_email: { variantId, email } }, update: { notifiedAt: null }, create: { variantId, email } });
  return { ok: t.product.notifySaved };
}

export async function requestReturn(_: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const number = String(formData.get("number"));
  const order = await db.order.findUnique({ where: { number }, include: { items: true } });
  if (!order || !(await canViewOrder(order, String(formData.get("k") || "")))) return { error: "Order not found" };
  const reason = String(formData.get("reason") || "");
  const items = order.items
    .map((i) => ({ orderItemId: i.id, quantity: Math.min(i.quantity, Math.max(0, Number(formData.get(`qty_${i.id}`) || 0))) }))
    .filter((i) => i.quantity > 0);
  if (!reason || !items.length) return { error: t.order.returnItems };
  const user = await getUser();
  await db.returnRequest.create({ data: { orderId: order.id, userId: user?.id, reason, details: String(formData.get("details") || "") || null, items: JSON.stringify(items) } });
  await orderEvent(order.id, "return", `Customer requested a return: ${reason}`);
  await logActivity(user ? { id: user.id, name: user.name } : null, "requested", "return", `Return requested for ${order.number}`, order.id);
  revalidatePath(`/order/${number}`);
  return { ok: t.order.returnSubmitted };
}

export async function askQuestion(_: FormState, formData: FormData): Promise<FormState> {
  const { locale } = await getI18n();
  const ar = locale === "ar";
  if (!(await limitByIp("question", 6, 3600))) return { error: ar ? "محاولات كثيرة." : "Too many attempts. Please try again later." };
  const productId = String(formData.get("productId") || "");
  const name = String(formData.get("name") || "").trim().slice(0, 60);
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const question = String(formData.get("question") || "").trim().slice(0, 1000);
  if (!name || !z.string().email().safeParse(email).success || question.length < 8) return { error: ar ? "يرجى تعبئة جميع الحقول." : "Please fill in all fields." };
  if (!(await db.product.findUnique({ where: { id: productId } }))) return { error: "Not found" };
  await db.productQuestion.create({ data: { productId, name, email, question } });
  return { ok: ar ? "شكرًا! سننشر سؤالك مع الإجابة قريبًا." : "Thanks! We'll publish your question with an answer soon." };
}

export async function submitTradeIn(_: FormState, formData: FormData): Promise<FormState> {
  const { locale } = await getI18n();
  const ar = locale === "ar";
  if (!(await limitByIp("tradein", 5, 3600))) return { error: ar ? "محاولات كثيرة." : "Too many requests. Please try again later." };
  const f = (k: string) => String(formData.get(k) || "").trim();
  if (!f("name") || !z.string().email().safeParse(f("email")).success || !/^(\+971|0)?5\d{8}$/.test(f("phone")) || !f("model")) return { error: ar ? "يرجى إدخال بيانات صحيحة." : "Please enter valid details (UAE mobile number)." };
  const t = await db.tradeIn.create({
    data: { name: f("name"), email: f("email").toLowerCase(), phone: f("phone"), emirate: f("emirate") || "Dubai", category: f("category"), model: f("model").slice(0, 120), condition: f("condition"), details: f("details") || null, estimate: Math.max(0, Number(f("estimate")) || 0), payout: f("payout") === "CASH" ? "CASH" : "CREDIT" },
  });
  const { sendEmail } = await import("@/lib/mailer");
  const { getSettings } = await import("@/lib/settings");
  const s = await getSettings();
  await sendEmail(t.email, ar ? "استلمنا طلب الاستبدال" : "We received your trade-in request", `<p>${ar ? "شكرًا" : "Thanks"} ${t.name}! ${t.model}: ${ar ? "التقدير" : "estimate"} AED ${t.estimate}. ${ar ? "سنتواصل معك خلال 24 ساعة لترتيب الاستلام." : "We'll contact you within 24 hours to arrange collection."}</p>`, "trade_in");
  if (s.notifications.staffEmail) await sendEmail(s.notifications.staffEmail, `New trade-in: ${t.model} (AED ${t.estimate})`, `<p>${t.name}, ${t.phone}, ${t.emirate}<br>${t.condition}<br>${t.details ?? ""}</p>`, "staff_trade_in");
  await logActivity(null, "created", "trade-in", `Trade-in request: ${t.model} from ${t.name}`, t.id);
  return { ok: ar ? "تم! سنتواصل معك خلال 24 ساعة." : "Done! We'll contact you within 24 hours to arrange free collection." };
}

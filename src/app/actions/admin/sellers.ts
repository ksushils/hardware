"use server";
import { postAdjustmentSafe, postPayoutSafe } from "@/lib/ledgerPosting";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { sendEmail, btn } from "@/lib/mailer";
import { siteUrl } from "@/lib/site";
import { updateSettings } from "@/lib/settings";
import { recomputeSellerRating, sellerBalance } from "@/lib/marketplace";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
function back(path: string, q: Record<string, string> = {}): never {
  const p = new URLSearchParams(q).toString();
  redirect(p ? `${path}?${p}` : path);
}
function refresh() {
  revalidatePath("/admin/sellers", "layout");
  revalidatePath("/", "layout");
}

async function emailSeller(sellerId: string, subject: string, body: string) {
  const s = await db.seller.findUnique({ where: { id: sellerId } });
  if (s) await sendEmail(s.email, subject, body, "seller_status");
}

export async function setSellerStatus(fd: FormData) {
  const user = await requirePermission("sellers");
  const id = str(fd, "id");
  const status = str(fd, "status");
  const reason = str(fd, "reason");
  if (!["APPROVED", "REJECTED", "SUSPENDED", "PENDING"].includes(status)) back(`/admin/sellers/${id}`, { error: "Invalid status" });
  if ((status === "REJECTED" || status === "SUSPENDED") && !reason) back(`/admin/sellers/${id}`, { error: "Please give a reason." });
  const seller = await db.seller.update({
    where: { id },
    data: { status, rejectionReason: status === "APPROVED" ? null : reason || null, approvedAt: status === "APPROVED" ? new Date() : undefined },
  });
  const msg: Record<string, [string, string]> = {
    APPROVED: [`Your shop ${seller.shopName} is approved 🎉`, `<p>Welcome to the TechRevive marketplace! You can now list products.</p>${btn(`${siteUrl()}/seller`, "Open seller portal")}`],
    REJECTED: [`Your seller application for ${seller.shopName}`, `<p>Unfortunately we couldn't approve your application.</p><p><b>Reason:</b> ${reason}</p><p>You can reply to this email with updated documents.</p>`],
    SUSPENDED: [`Your shop ${seller.shopName} has been suspended`, `<p>Your products are hidden from the store while your shop is suspended.</p><p><b>Reason:</b> ${reason}</p>`],
    PENDING: [`Your shop ${seller.shopName} is under review`, `<p>Your shop is being reviewed again by our team.</p>`],
  };
  await emailSeller(id, ...msg[status]);
  await logActivity(user, status.toLowerCase(), "seller", `${status} seller ${seller.shopName}${reason ? `: ${reason}` : ""}`, id);
  refresh();
  back(`/admin/sellers/${id}`, { msg: `Seller ${status.toLowerCase()}.` });
}

export async function setSellerCommission(fd: FormData) {
  const user = await requirePermission("sellers");
  const id = str(fd, "id");
  const type = str(fd, "type");
  await db.seller.update({
    where: { id },
    data: type ? { commissionType: type, commissionRate: Number(fd.get("percent") || 0), commissionFixed: Number(fd.get("fixed") || 0) } : { commissionType: null, commissionRate: null, commissionFixed: null },
  });
  await logActivity(user, "updated", "seller", `Commission override ${type || "removed"} for seller ${id}`, id);
  refresh();
  back(`/admin/sellers/${id}`, { msg: "Commission saved." });
}

export async function adjustSellerBalance(fd: FormData) {
  const user = await requirePermission("sellers");
  const id = str(fd, "id");
  const amount = Math.round(Number(fd.get("amount")) * 100) / 100;
  const note = str(fd, "note");
  if (!amount || !note) back(`/admin/sellers/${id}`, { error: "Enter a non-zero amount and a note." });
  const adjTx = await db.sellerTransaction.create({ data: { sellerId: id, type: "ADJUSTMENT", amount, note } });
  await postAdjustmentSafe(adjTx.id); // double-entry ledger
  await logActivity(user, "adjusted", "seller", `Balance adjustment AED ${amount} (${note})`, id);
  refresh();
  back(`/admin/sellers/${id}`, { msg: "Adjustment recorded." });
}

export async function updateSellerProfile(fd: FormData) {
  const user = await requirePermission("sellers");
  const id = str(fd, "id");
  await db.seller.update({
    where: { id },
    data: { shopName: str(fd, "shopName"), email: str(fd, "email"), phone: str(fd, "phone"), trn: str(fd, "trn") || null, tradeLicenseNo: str(fd, "tradeLicenseNo") || null, tradeLicenseExpiry: str(fd, "tradeLicenseExpiry") ? new Date(str(fd, "tradeLicenseExpiry")) : null },
  });
  await logActivity(user, "updated", "seller", `Updated seller profile ${id}`, id);
  refresh();
  back(`/admin/sellers/${id}`, { msg: "Profile saved." });
}

/** Approve/reject marketplace products (single or bulk). */
export async function reviewProducts(fd: FormData) {
  const user = await requirePermission("sellers");
  const ids = fd.getAll("ids").map(String).filter(Boolean);
  const decision = str(fd, "decision");
  const reason = str(fd, "reason");
  const ret = str(fd, "return") || "/admin/sellers/products";
  if (!ids.length) back(ret, { error: "Select at least one product." });
  if (decision === "REJECTED" && !reason) back(ret, { error: "Give a reason when rejecting." });
  const products = await db.product.findMany({ where: { id: { in: ids }, sellerId: { not: null } }, include: { seller: true } });
  for (const p of products) {
    await db.product.update({ where: { id: p.id }, data: { approvalStatus: decision === "APPROVED" ? "APPROVED" : "REJECTED", rejectionReason: decision === "APPROVED" ? null : reason } });
    // the creator's own offers on this new product follow the product decision (offers of other sellers are never touched)
    await db.variant.updateMany({
      where: { productId: p.id, sellerId: p.sellerId, approvalStatus: { in: ["PENDING", "DRAFT"] } },
      data: decision === "APPROVED" ? { approvalStatus: "APPROVED", rejectionReason: null } : { approvalStatus: "REJECTED", rejectionReason: reason },
    });
    if (p.seller)
      await sendEmail(p.seller.email, decision === "APPROVED" ? `Product approved: ${p.name}` : `Product needs changes: ${p.name}`,
        decision === "APPROVED" ? `<p><b>${p.name}</b> is now live on the store.</p>${btn(`${siteUrl()}/products/${p.slug}`, "View product")}` : `<p><b>${p.name}</b> was not approved.</p><p><b>Reason:</b> ${reason}</p>${btn(`${siteUrl()}/seller/products/${p.id}`, "Edit product")}`,
        "seller_product_review");
  }
  await logActivity(user, decision.toLowerCase(), "product", `${decision} ${products.length} marketplace product(s)${reason ? `: ${reason}` : ""}`);
  refresh();
  back(ret, { msg: `${products.length} product(s) ${decision.toLowerCase()}.` });
}

export async function processPayout(fd: FormData) {
  const user = await requirePermission("sellers");
  const id = str(fd, "id");
  const action = str(fd, "action");
  const payout = await db.payout.findUnique({ where: { id }, include: { seller: true } });
  if (!payout) back("/admin/sellers/payouts", { error: "Payout not found" });
  if (action === "approve" && payout.status === "REQUESTED") {
    await db.payout.update({ where: { id }, data: { status: "APPROVED" } });
  } else if (action === "paid" && ["REQUESTED", "APPROVED"].includes(payout.status)) {
    const reference = str(fd, "reference");
    if (!reference) back("/admin/sellers/payouts", { error: "Enter the bank transfer reference." });
    await db.$transaction([
      db.payout.update({ where: { id }, data: { status: "PAID", reference, paidAt: new Date(), adminNote: str(fd, "note") || null } }),
      db.sellerTransaction.create({ data: { sellerId: payout.sellerId, type: "PAYOUT", amount: -payout.amount, payoutId: id, note: `Payout ${reference}` } }),
    ]);
    await postPayoutSafe(id); // double-entry ledger
    await sendEmail(payout.seller.email, `Payout of AED ${payout.amount} sent`, `<p>We've transferred <b>AED ${payout.amount}</b> to your bank account (${payout.seller.iban ?? "on file"}).</p><p>Reference: ${reference}</p>`, "seller_payout_paid");
  } else if (action === "reject" && ["REQUESTED", "APPROVED"].includes(payout.status)) {
    const note = str(fd, "note");
    await db.payout.update({ where: { id }, data: { status: "REJECTED", adminNote: note || null } });
    await sendEmail(payout.seller.email, "Payout request declined", `<p>Your payout request of AED ${payout.amount} was declined.${note ? ` Reason: ${note}` : ""}</p>`, "seller_payout_rejected");
  } else back("/admin/sellers/payouts", { error: "Invalid action for this payout." });
  await logActivity(user, action, "payout", `Payout ${id} (${payout.seller.shopName}, AED ${payout.amount}) → ${action}`, id);
  refresh();
  back("/admin/sellers/payouts", { msg: "Payout updated." });
}

/** Create a payout on behalf of a seller (pay out their full available balance). */
export async function payoutFullBalance(fd: FormData) {
  const user = await requirePermission("sellers");
  const sellerId = str(fd, "sellerId");
  const bal = await sellerBalance(sellerId);
  if (bal.available <= 0) back("/admin/sellers/payouts", { error: "No available balance." });
  await db.payout.create({ data: { sellerId, amount: bal.available, status: "APPROVED", adminNote: "Created by admin" } });
  await logActivity(user, "created", "payout", `Payout AED ${bal.available} created for seller ${sellerId}`, sellerId);
  refresh();
  back("/admin/sellers/payouts", { msg: "Payout created — mark it paid once transferred." });
}

export async function saveCommissionRule(fd: FormData) {
  const user = await requirePermission("sellers");
  const id = str(fd, "id");
  const scope = str(fd, "scope");
  const data = {
    scope, type: str(fd, "type") || "PERCENT", percent: Number(fd.get("percent") || 0), fixed: Number(fd.get("fixed") || 0), active: fd.get("active") === "on",
    categoryId: scope === "CATEGORY" ? str(fd, "categoryId") || null : null,
    sellerId: scope === "SELLER" ? str(fd, "sellerId") || null : null,
    productId: scope === "PRODUCT" ? str(fd, "productId") || null : null,
  };
  if (!["GLOBAL", "CATEGORY", "SELLER", "PRODUCT"].includes(scope)) back("/admin/sellers/commission", { error: "Invalid scope" });
  if ((scope === "CATEGORY" && !data.categoryId) || (scope === "SELLER" && !data.sellerId) || (scope === "PRODUCT" && !data.productId)) back("/admin/sellers/commission", { error: `Choose a ${scope.toLowerCase()} for this rule.` });
  if (data.percent < 0 || data.percent > 100 || data.fixed < 0) back("/admin/sellers/commission", { error: "Percent must be 0–100 and fixed ≥ 0." });
  if (id) await db.commissionRule.update({ where: { id }, data });
  else await db.commissionRule.create({ data });
  await logActivity(user, id ? "updated" : "created", "commission", `Commission rule ${scope} ${data.type} ${data.percent}%/${data.fixed}`);
  refresh();
  back("/admin/sellers/commission", { msg: "Rule saved." });
}

export async function deleteCommissionRule(fd: FormData) {
  const user = await requirePermission("sellers");
  await db.commissionRule.delete({ where: { id: str(fd, "id") } });
  await logActivity(user, "deleted", "commission", "Deleted commission rule");
  refresh();
  back("/admin/sellers/commission", { msg: "Rule deleted." });
}

export async function saveMarketplaceSettings(fd: FormData) {
  const user = await requirePermission("sellers");
  await updateSettings({
    marketplace: {
      enabled: fd.get("enabled") === "on",
      defaultCommissionPercent: Number(fd.get("defaultCommissionPercent") || 0),
      autoApproveSellers: fd.get("autoApproveSellers") === "on",
      autoApproveProducts: fd.get("autoApproveProducts") === "on",
      minPayout: Number(fd.get("minPayout") || 0),
      holdDays: Math.max(0, Math.floor(Number(fd.get("holdDays") || 0))),
      sellerTerms: str(fd, "sellerTerms"),
      sellerTermsAr: str(fd, "sellerTermsAr"),
    },
  });
  await logActivity(user, "updated", "settings", "Updated marketplace settings");
  refresh();
  back("/admin/sellers/commission", { msg: "Marketplace settings saved." });
}

export async function moderateSellerReview(fd: FormData) {
  const user = await requirePermission("sellers");
  const id = str(fd, "id");
  const action = str(fd, "action");
  const r = await db.sellerReview.findUnique({ where: { id } });
  if (!r) return;
  if (action === "delete") await db.sellerReview.delete({ where: { id } });
  else await db.sellerReview.update({ where: { id }, data: { status: action === "publish" ? "PUBLISHED" : "HIDDEN" } });
  await recomputeSellerRating(r.sellerId);
  await logActivity(user, action, "seller_review", `Seller review ${id} → ${action}`, id);
  refresh();
  back("/admin/sellers/reviews", { msg: "Review updated." });
}

export async function answerQuestion(fd: FormData) {
  const user = await requirePermission("products");
  const id = str(fd, "id");
  const action = str(fd, "action");
  const q = await db.productQuestion.findUnique({ where: { id } });
  if (!q) back("/admin/questions", { error: "Question not found" });
  if (action === "delete") await db.productQuestion.delete({ where: { id } });
  else if (action === "unpublish") await db.productQuestion.update({ where: { id }, data: { published: false } });
  else {
    const answer = str(fd, "answer");
    if (!answer) back("/admin/questions", { error: "Write an answer first." });
    await db.productQuestion.update({ where: { id }, data: { answer, answeredAt: q.answeredAt ?? new Date(), published: true } });
    const product = await db.product.findUnique({ where: { id: q.productId } });
    if (!q.answer && product)
      await sendEmail(q.email, `Your question about ${product.name} was answered`, `<p><b>Q:</b> ${q.question.replace(/</g, "&lt;")}</p><p><b>A:</b> ${answer.replace(/</g, "&lt;")}</p>${btn(`${siteUrl()}/products/${product.slug}`, "View product")}`, "question_answered");
  }
  await logActivity(user, action || "answered", "question", `Product question ${id} → ${action || "answered"}`, id);
  revalidatePath("/admin/questions");
  revalidatePath("/products/[slug]", "page");
  back("/admin/questions", { msg: "Saved." });
}

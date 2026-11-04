"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { sendEmail, btn } from "@/lib/mailer";
import { siteUrl } from "@/lib/site";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
function back(path: string, q: Record<string, string> = {}): never {
  const p = new URLSearchParams(q).toString();
  redirect(p ? `${path}?${p}` : path);
}
const refresh = () => { revalidatePath("/admin/sellers", "layout"); revalidatePath("/", "layout"); };

/** Approve / reject seller offers (single or bulk). Needs the "sellers" permission. */
export async function reviewOffers(fd: FormData) {
  const user = await requirePermission("sellers");
  const ids = fd.getAll("ids").map(String).filter(Boolean);
  const decision = str(fd, "decision");
  const reason = str(fd, "reason");
  const ret = str(fd, "return") || "/admin/sellers/products";
  if (!ids.length) back(ret, { error: "Select at least one offer." });
  if (!["APPROVED", "REJECTED"].includes(decision)) back(ret, { error: "Invalid decision." });
  if (decision === "REJECTED" && !reason) back(ret, { error: "Give a reason when rejecting." });
  const offers = await db.variant.findMany({ where: { id: { in: ids }, sellerId: { not: null } }, include: { seller: true, product: { select: { name: true, slug: true } } } });
  for (const v of offers) {
    await db.variant.update({ where: { id: v.id }, data: { approvalStatus: decision, rejectionReason: decision === "APPROVED" ? null : reason } });
    if (v.seller) {
      const label = `${v.product.name}${v.title !== "Default Title" ? ` (${v.title})` : ""}`;
      await sendEmail(v.seller.email, decision === "APPROVED" ? `Offer approved: ${label}` : `Offer needs changes: ${label}`,
        decision === "APPROVED" ? `<p>Your offer for <b>${label}</b> is now live.</p>${btn(`${siteUrl()}/products/${v.product.slug}`, "View product page")}`
          : `<p>Your offer for <b>${label}</b> was not approved.</p><p><b>Reason:</b> ${reason.replace(/</g, "&lt;")}</p>${btn(`${siteUrl()}/seller/products/offers/${v.id}`, "Edit offer")}`, "seller_offer_review");
    }
  }
  await logActivity(user, decision.toLowerCase(), "offer", `${decision} ${offers.length} seller offer(s)${reason ? `: ${reason}` : ""}`);
  refresh();
  back(ret, { msg: `${offers.length} offer(s) ${decision.toLowerCase()}.` });
}

/**
 * Staff-only: record the verification level of an offer's condition evidence.
 * PLATFORM_VERIFIED requires evidence to exist, a verifier name and a date, so the badge is never shown without backing.
 */
export async function setOfferVerification(fd: FormData) {
  const user = await requirePermission("sellers");
  const id = str(fd, "id");
  const level = str(fd, "verification");
  const ret = str(fd, "return") || "/admin/sellers/products";
  if (!["NONE", "SELLER_DECLARED", "PLATFORM_VERIFIED"].includes(level)) back(ret, { error: "Invalid verification level." });
  const v = await db.variant.findUnique({ where: { id }, include: { product: { select: { name: true } } } });
  if (!v) back(ret, { error: "Offer not found." });
  const hasEvidence = !!(v.cosmeticGrade || v.functionalStatus || v.batteryHealth != null || v.batteryCycles != null || v.repairDisclosure || v.accessories || v.testedAt || v.testNotes);
  const data: { verification: string; testedBy?: string | null; testedAt?: Date | null; testNotes?: string | null } = { verification: level };
  if (level === "PLATFORM_VERIFIED") {
    const testedBy = str(fd, "testedBy");
    const testedAtRaw = str(fd, "testedAt");
    const testedAt = testedAtRaw ? new Date(testedAtRaw) : null;
    if (!hasEvidence) back(ret, { error: "Nothing to verify: the seller supplied no condition evidence." });
    if (!testedBy) back(ret, { error: "Enter who verified the unit (tester / lab name)." });
    if (!testedAt || Number.isNaN(+testedAt) || testedAt > new Date()) back(ret, { error: "Enter a valid verification date (not in the future)." });
    data.testedBy = testedBy;
    data.testedAt = testedAt;
    const notes = str(fd, "testNotes");
    if (notes) data.testNotes = notes;
  }
  await db.variant.update({ where: { id }, data });
  await logActivity(user, "verified", "offer", `Set evidence verification of "${v.product.name}" (${v.title}) to ${level}`, id);
  refresh();
  back(ret, { msg: `Verification set to ${level.toLowerCase().replace("_", " ")}.` });
}

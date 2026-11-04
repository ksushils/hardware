"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function setReviewStatus(fd: FormData) {
  const user = await requirePermission("products");
  const id = String(fd.get("id"));
  const status = String(fd.get("status"));
  if (!["PUBLISHED", "PENDING", "HIDDEN"].includes(status)) return;
  const r = await db.review.update({ where: { id }, data: { status }, include: { product: { select: { name: true } } } });
  await logActivity(user, "updated", "review", `Review on "${r.product.name}" set to ${status.toLowerCase()}`, id);
  revalidatePath("/admin/reviews");
  revalidatePath("/", "layout");
}

export async function replyReview(fd: FormData) {
  const user = await requirePermission("products");
  const id = String(fd.get("id"));
  const reply = String(fd.get("reply") || "").trim();
  await db.review.update({ where: { id }, data: { reply: reply || null } });
  await logActivity(user, "updated", "review", reply ? "Replied to a review" : "Removed review reply", id);
  revalidatePath("/admin/reviews");
  revalidatePath("/", "layout");
}

export async function deleteReview(fd: FormData) {
  const user = await requirePermission("products");
  const id = String(fd.get("id"));
  await db.review.delete({ where: { id } }).catch(() => null);
  await logActivity(user, "deleted", "review", "Deleted a review", id);
  revalidatePath("/admin/reviews");
  revalidatePath("/", "layout");
}

export async function bulkReviews(fd: FormData) {
  const user = await requirePermission("products");
  const ids = fd.getAll("ids").map(String);
  const action = String(fd.get("action"));
  if (!ids.length) return;
  if (action === "delete") await db.review.deleteMany({ where: { id: { in: ids } } });
  else if (["PUBLISHED", "HIDDEN", "PENDING"].includes(action)) await db.review.updateMany({ where: { id: { in: ids } }, data: { status: action } });
  await logActivity(user, "bulk", "review", `Bulk ${action.toLowerCase()} on ${ids.length} review(s)`);
  revalidatePath("/admin/reviews");
  revalidatePath("/", "layout");
}

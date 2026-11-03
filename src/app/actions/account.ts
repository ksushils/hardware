"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getUser, hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { EMIRATES } from "@/lib/format";
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

const addressSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required"),
  phone: z.string().trim().regex(/^(\+971|0)?5\d{8}$/, "Enter a valid UAE mobile number"),
  emirate: z.enum(EMIRATES as [string, ...string[]]),
  area: z.string().trim().min(2, "Area is required"),
  street: z.string().trim().min(2, "Street is required"),
  building: z.string().trim().min(1, "Building / villa is required"),
});

export async function saveAddress(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/account/addresses");
  const parsed = addressSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const count = await db.address.count({ where: { userId: user.id } });
  await db.address.create({ data: { ...parsed.data, userId: user.id, isDefault: count === 0 } });
  revalidatePath("/account/addresses");
  return { ok: "Address saved." };
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
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  if (name.length < 2) return { error: "Name is too short." };
  await db.user.update({ where: { id: user.id }, data: { name, phone: phone || null } });
  const current = String(formData.get("currentPassword") || "");
  const next = String(formData.get("newPassword") || "");
  if (next) {
    const full = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!(await verifyPassword(current, full.password))) return { error: "Current password is incorrect." };
    if (next.length < 8) return { error: "New password must be at least 8 characters." };
    await db.user.update({ where: { id: user.id }, data: { password: await hashPassword(next) } });
  }
  revalidatePath("/account");
  return { ok: "Profile updated." };
}

export async function submitReview(_: FormState, formData: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) return { error: "Please log in to write a review." };
  const productId = String(formData.get("productId"));
  const rating = Number(formData.get("rating"));
  const comment = String(formData.get("comment") || "").trim();
  if (!(rating >= 1 && rating <= 5)) return { error: "Please choose a rating." };
  if (comment.length < 5) return { error: "Please write a short comment." };
  await db.review.upsert({
    where: { productId_userId: { productId, userId: user.id } },
    update: { rating, comment },
    create: { productId, userId: user.id, rating, comment },
  });
  revalidatePath("/products/[slug]", "page");
  return { ok: "Thanks for your review!" };
}

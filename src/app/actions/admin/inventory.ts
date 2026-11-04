"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { adjustStock } from "@/lib/orders";

const REASONS = ["received", "correction", "damaged", "returned", "other"];

export async function adjustInventory(variantId: string, mode: "adjust" | "set", value: number, reason: string, note = "") {
  const user = await requirePermission("products");
  if (!Number.isFinite(value) || !Number.isInteger(value)) return { error: "Enter a whole number." };
  if (!REASONS.includes(reason)) return { error: "Invalid reason." };
  const v = await db.variant.findUnique({ where: { id: variantId }, include: { product: { select: { name: true } } } });
  if (!v) return { error: "Variant not found." };
  const delta = mode === "set" ? value - v.stock : value;
  if (mode === "set" && value < 0) return { error: "Quantity can't be negative." };
  if (!delta) return { ok: true, stock: v.stock };
  await adjustStock(variantId, delta, reason, user.id, note || undefined);
  await logActivity(user, "inventory", "variant", `${delta > 0 ? "+" : ""}${delta} ${v.product.name} (${v.title}): ${reason}`, variantId);
  revalidatePath("/admin/inventory");
  revalidatePath("/", "layout");
  return { ok: true, stock: v.stock + delta };
}

export async function setTracking(variantId: string, trackInventory: boolean, continueSelling: boolean) {
  const user = await requirePermission("products");
  const v = await db.variant.update({ where: { id: variantId }, data: { trackInventory, continueSelling } });
  await logActivity(user, "updated", "variant", `Inventory settings for ${v.title}: track=${trackInventory}, oversell=${continueSelling}`, variantId);
  revalidatePath("/admin/inventory");
  return { ok: true };
}

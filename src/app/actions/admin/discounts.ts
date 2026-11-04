"use server";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

type State = { error?: string; ok?: string } | undefined;
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => { const v = s(fd, k); return v === "" ? null : Number(v); };

export async function saveDiscount(_: State, fd: FormData): Promise<State> {
  const user = await requirePermission("discounts");
  const id = s(fd, "id");
  const method = s(fd, "method") === "AUTOMATIC" ? "AUTOMATIC" : "CODE";
  const type = s(fd, "type");
  const title = s(fd, "title");
  const code = method === "CODE" ? s(fd, "code").toUpperCase().replace(/\s+/g, "") : null;
  if (!["PERCENT", "FIXED", "FREE_SHIPPING", "BXGY"].includes(type)) return { error: "Choose a discount type." };
  if (method === "CODE" && !/^[A-Z0-9_-]{3,30}$/.test(code ?? "")) return { error: "Discount code must be 3–30 letters, numbers, - or _." };
  const value = Number(fd.get("value") || 0);
  if (type === "PERCENT" && (!(value > 0) || value > 100)) return { error: "Percentage must be between 1 and 100." };
  if (type === "FIXED" && !(value > 0)) return { error: "Enter a discount amount." };
  if (type === "BXGY" && (!(value > 0) || value > 100)) return { error: "Enter the % off for the free/discounted items (100 = free)." };
  const buyQty = type === "BXGY" ? Math.max(1, Math.floor(num(fd, "buyQty") ?? 1)) : null;
  const getQty = type === "BXGY" ? Math.max(1, Math.floor(num(fd, "getQty") ?? 1)) : null;
  const appliesTo = ["ALL", "COLLECTIONS", "PRODUCTS"].includes(s(fd, "appliesTo")) ? s(fd, "appliesTo") : "ALL";
  const targetIds = appliesTo === "ALL" ? "" : fd.getAll("targetIds").map(String).filter(Boolean).join(",");
  if (appliesTo !== "ALL" && !targetIds) return { error: `Select at least one ${appliesTo === "PRODUCTS" ? "product" : "collection"}.` };
  const minType = ["NONE", "AMOUNT", "QUANTITY"].includes(s(fd, "minType")) ? s(fd, "minType") : "NONE";
  const minValue = minType === "NONE" ? 0 : Number(fd.get("minValue") || 0);
  if (minType !== "NONE" && !(minValue > 0)) return { error: "Enter the minimum requirement value." };
  const startsAt = s(fd, "startsAt") ? new Date(s(fd, "startsAt")) : new Date();
  const endsAt = s(fd, "endsAt") ? new Date(s(fd, "endsAt")) : null;
  if (endsAt && endsAt <= startsAt) return { error: "End date must be after the start date." };
  const usageLimit = num(fd, "usageLimit");

  const data = {
    title: title || (code ?? "Automatic discount"), code, method, type, value: type === "FREE_SHIPPING" ? 0 : value, appliesTo, targetIds,
    minType, minValue, buyQty, getQty, usageLimit: usageLimit && usageLimit > 0 ? Math.floor(usageLimit) : null,
    oncePerCustomer: fd.get("oncePerCustomer") === "on", startsAt, endsAt, active: fd.get("active") === "on",
  };
  try {
    if (id) {
      await db.discount.update({ where: { id }, data });
      await logActivity(user, "updated", "discount", `Updated discount ${data.title}`, id);
    } else {
      const d = await db.discount.create({ data });
      await logActivity(user, "created", "discount", `Created discount ${data.title}`, d.id);
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: `The code ${code} is already in use. Choose a different code.` };
    throw e;
  }
  redirect(`/admin/discounts?msg=${encodeURIComponent("Discount saved.")}`);
}

export async function deleteDiscount(fd: FormData) {
  const user = await requirePermission("discounts");
  const d = await db.discount.delete({ where: { id: s(fd, "id") } });
  await logActivity(user, "deleted", "discount", `Deleted discount ${d.title}`);
  redirect(`/admin/discounts?msg=${encodeURIComponent("Discount deleted.")}`);
}

export async function duplicateDiscount(fd: FormData) {
  const user = await requirePermission("discounts");
  const d = await db.discount.findUniqueOrThrow({ where: { id: s(fd, "id") } });
  const { id: _id, createdAt: _c, usedCount: _u, ...rest } = d;
  let code = d.code;
  if (code) {
    for (let i = 2; ; i++) {
      const candidate = `${d.code}${i}`.slice(0, 30);
      if (!(await db.discount.findUnique({ where: { code: candidate } }))) { code = candidate; break; }
    }
  }
  const copy = await db.discount.create({ data: { ...rest, code, title: `${d.title} (copy)`, active: false } });
  await logActivity(user, "created", "discount", `Duplicated discount ${d.title}`, copy.id);
  redirect(`/admin/discounts/${copy.id}?msg=${encodeURIComponent("Duplicated. The copy is inactive until you enable it.")}`);
}

export async function toggleDiscount(fd: FormData) {
  const user = await requirePermission("discounts");
  const d = await db.discount.findUniqueOrThrow({ where: { id: s(fd, "id") } });
  await db.discount.update({ where: { id: d.id }, data: { active: !d.active } });
  await logActivity(user, d.active ? "deactivated" : "activated", "discount", `${d.active ? "Deactivated" : "Activated"} ${d.title}`, d.id);
  redirect(`/admin/discounts?msg=${encodeURIComponent(d.active ? "Discount deactivated." : "Discount activated.")}`);
}

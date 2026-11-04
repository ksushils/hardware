"use server";
import { orderUrl } from "@/lib/orderAccess";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { logActivity, orderEvent } from "@/lib/activity";
import { adjustStock, markOrderPaid, newOrderNumber } from "@/lib/orders";
import { computeTotals, warrantyPrice } from "@/lib/pricing";
import { getSettings, pricingConfig } from "@/lib/settings";
import { sendEmail, btn } from "@/lib/mailer";
import { siteUrl } from "@/lib/site";
import { aed, csv } from "@/lib/format";

type State = { error?: string; ok?: string } | undefined;

export async function searchVariants(q: string) {
  await requirePermission("orders");
  const term = q.trim();
  if (!term) return [];
  const variants = await db.variant.findMany({
    where: {
      product: { status: { not: "ARCHIVED" } },
      OR: [{ sku: { contains: term } }, { title: { contains: term } }, { product: { name: { contains: term } } }, { product: { brand: { contains: term } } }],
    },
    include: { product: { select: { name: true, brand: true, image: true } } },
    take: 20,
  });
  return variants.map((v) => ({
    variantId: v.id, name: `${v.product.brand} ${v.product.name}`, variantTitle: v.title === "Default Title" ? "" : v.title,
    price: v.price, stock: v.stock, tracked: v.trackInventory && !v.continueSelling, image: v.image || v.product.image, sku: v.sku,
  }));
}

export async function searchCustomers(q: string) {
  await requirePermission("orders");
  const term = q.trim();
  if (!term) return [];
  const users = await db.user.findMany({
    where: { OR: [{ name: { contains: term } }, { email: { contains: term.toLowerCase() } }, { phone: { contains: term } }] },
    include: { addresses: { orderBy: { isDefault: "desc" }, take: 1 } },
    take: 10,
  });
  return users.map((u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone ?? "", address: u.addresses[0] ?? null }));
}

const payloadSchema = z.object({
  number: z.string().optional(),
  email: z.string().trim().toLowerCase().email("Enter the customer's email."),
  fullName: z.string().trim().min(1, "Enter the customer's name."),
  phone: z.string().trim().default(""),
  emirate: z.string().default("Dubai"),
  area: z.string().default(""),
  street: z.string().default(""),
  building: z.string().default(""),
  lines: z.array(z.object({ variantId: z.string(), quantity: z.number().int().min(1).max(999), warranty: z.boolean().default(false) })).min(1, "Add at least one product."),
  discountType: z.enum(["none", "amount", "percent"]).default("none"),
  discountValue: z.number().min(0).default(0),
  discountReason: z.string().default(""),
  shippingRateId: z.string().default(""),
  customShipping: z.number().min(0).default(0),
  customShippingName: z.string().default(""),
  note: z.string().default(""),
  tags: z.string().default(""),
});

export async function saveDraft(_: State, fd: FormData): Promise<State> {
  const user = await requirePermission("orders");
  let parsed;
  try {
    parsed = payloadSchema.safeParse(JSON.parse(String(fd.get("payload") || "{}")));
  } catch {
    return { error: "Invalid form data." };
  }
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const p = parsed.data;
  const s = await getSettings();
  const cfg = pricingConfig(s);

  const variants = await db.variant.findMany({ where: { id: { in: p.lines.map((l) => l.variantId) } }, include: { product: true } });
  const items = p.lines.flatMap((l) => {
    const v = variants.find((x) => x.id === l.variantId);
    if (!v) return [];
    return [{
      variantId: v.id, productId: v.productId, name: `${v.product.brand} ${v.product.name}`, variantTitle: v.title === "Default Title" ? "" : v.title,
      sku: v.sku, image: v.image || v.product.image, price: v.price, cost: v.cost, quantity: l.quantity, warranty: l.warranty,
      warrantyPrice: l.warranty ? warrantyPrice(v.price, cfg) : 0,
    }];
  });
  if (!items.length) return { error: "Selected products no longer exist." };

  let rate: { price: number; freeAbove: number | null } | null = null;
  let rateName = p.customShippingName || "Custom shipping";
  if (p.shippingRateId === "custom") rate = { price: p.customShipping, freeAbove: null };
  else if (p.shippingRateId) {
    const r = await db.shippingRate.findUnique({ where: { id: p.shippingRateId } });
    if (r) { rate = { price: r.price, freeAbove: r.freeAbove }; rateName = r.name; }
  } else rateName = "No shipping";

  const lines = items.map((i) => ({ price: i.price, quantity: i.quantity, warranty: i.warranty }));
  const pre = computeTotals(lines, { cfg });
  const discount = p.discountType === "amount" ? p.discountValue : p.discountType === "percent" ? Math.round(pre.subtotal * Math.min(p.discountValue, 100)) / 100 : 0;
  const t = computeTotals(lines, { rate, discount, cfg });
  const existingUser = await db.user.findUnique({ where: { email: p.email } });

  const data = {
    email: p.email, userId: existingUser?.id ?? null, fullName: p.fullName, phone: p.phone, emirate: p.emirate, area: p.area, street: p.street, building: p.building,
    subtotal: t.subtotal, discount: t.discount, discountTitle: t.discount > 0 ? `Custom discount${p.discountReason ? `: ${p.discountReason}` : ""}` : null, discountCode: null,
    shipping: t.shipping, codFee: 0, vat: t.vat, total: t.total, shippingRateName: rateName, note: p.note || null, tags: csv(p.tags).join(","),
  };

  let number = p.number;
  if (number) {
    const existing = await db.order.findUnique({ where: { number } });
    if (!existing || existing.status !== "DRAFT") return { error: "This draft has already been completed." };
    await db.$transaction([
      db.orderItem.deleteMany({ where: { orderId: existing.id } }),
      db.order.update({ where: { id: existing.id }, data: { ...data, items: { create: items } } }),
    ]);
    await orderEvent(existing.id, "edited", "Draft order updated.", user.id);
  } else {
    number = newOrderNumber();
    const o = await db.order.create({
      data: { ...data, number, status: "DRAFT", source: "ADMIN", paymentMethod: "MANUAL", paymentStatus: "PENDING", locale: existingUser?.locale ?? "en", items: { create: items } },
    });
    await orderEvent(o.id, "edited", `Draft order created by ${user.name}.`, user.id);
    await logActivity(user, "created", "order", `Created draft order ${number}`, o.id);
  }
  redirect(`/admin/draft-orders/${number}?msg=${encodeURIComponent("Draft saved.")}`);
}

async function loadDraft(fd: FormData) {
  const user = await requirePermission("orders");
  const number = String(fd.get("number"));
  const order = await db.order.findUnique({ where: { number }, include: { items: true } });
  if (!order || order.status !== "DRAFT") redirect("/admin/draft-orders?error=Draft%20not%20found");
  return { user, order };
}

export async function sendDraftInvoice(fd: FormData) {
  const { user, order } = await loadDraft(fd);
  const s = await getSettings();
  const custom = String(fd.get("message") || "").trim();
  await db.order.update({ where: { id: order.id }, data: { paymentMethod: "CARD" } });
  const rows = order.items.map((i) => `<tr><td style="padding:6px 0">${i.name}${i.variantTitle ? ` (${i.variantTitle})` : ""} × ${i.quantity}</td><td style="text-align:right">${aed((i.price + i.warrantyPrice) * i.quantity)}</td></tr>`).join("");
  const html = `<h2 style="margin:0 0 8px">Invoice ${order.number}</h2>
<p>Hi ${order.fullName}, here's your invoice from ${s.storeName}.</p>${custom ? `<p>${custom.replace(/</g, "&lt;")}</p>` : ""}
<table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">${rows}
${order.discount > 0 ? `<tr><td>Discount</td><td style="text-align:right">− ${aed(order.discount)}</td></tr>` : ""}
<tr><td>Shipping</td><td style="text-align:right">${order.shipping ? aed(order.shipping) : "Free"}</td></tr>
<tr><td style="border-top:1px solid #e2e8f0;padding-top:8px"><b>Total (incl. VAT)</b></td><td style="border-top:1px solid #e2e8f0;padding-top:8px;text-align:right"><b>${aed(order.total)}</b></td></tr></table>
${btn(orderUrl(order.number), "Pay now")}`;
  await sendEmail(order.email, `Invoice ${order.number} from ${s.storeName}`, html, "draft_invoice");
  await orderEvent(order.id, "email", `Invoice sent to ${order.email}.`, user.id);
  await logActivity(user, "emailed", "order", `Sent invoice for draft ${order.number}`, order.id);
  redirect(`/admin/draft-orders/${order.number}?msg=${encodeURIComponent(`Invoice sent to ${order.email}.`)}`);
}

export async function completeDraft(fd: FormData) {
  const { user, order } = await loadDraft(fd);
  const paid = String(fd.get("paid") || "1") === "1";
  // stock check
  for (const i of order.items) {
    if (!i.variantId) continue;
    const v = await db.variant.findUnique({ where: { id: i.variantId } });
    if (v && v.trackInventory && !v.continueSelling && v.stock < i.quantity)
      redirect(`/admin/draft-orders/${order.number}?error=${encodeURIComponent(`Not enough stock for ${i.name} (${v.stock} available).`)}`);
  }
  for (const i of order.items) {
    if (!i.variantId) continue;
    const v = await db.variant.findUnique({ where: { id: i.variantId } });
    if (v?.trackInventory) await adjustStock(i.variantId, -i.quantity, "sold", user.id, `Order ${order.number}`);
  }
  await db.order.update({ where: { id: order.id }, data: { status: "OPEN", paymentMethod: paid ? "MANUAL" : "COD", createdAt: new Date() } });
  await orderEvent(order.id, "placed", `Draft completed by ${user.name}${paid ? " and marked as paid" : " (payment pending)"}.`, user.id);
  if (paid) await markOrderPaid(order.number, "manual", user.id);
  await logActivity(user, "completed", "order", `Completed draft ${order.number}`, order.id);
  redirect(`/admin/orders/${order.number}?msg=${encodeURIComponent("Order created.")}`);
}

export async function deleteDraft(fd: FormData) {
  const { user, order } = await loadDraft(fd);
  await db.order.delete({ where: { id: order.id } });
  await logActivity(user, "deleted", "order", `Deleted draft ${order.number}`);
  redirect(`/admin/draft-orders?msg=${encodeURIComponent("Draft deleted.")}`);
}

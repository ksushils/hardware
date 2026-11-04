import "server-only";
import type { Order, OrderItem } from "@prisma/client";
import { getSettings } from "./settings";
import { sendEmail, btn } from "./mailer";
import { orderUrl } from "./orderAccess";
import { orderEvent } from "./activity";

type Kind = "confirmation" | "shipped" | "delivered" | "refunded" | "cancelled";

const subjects: Record<Kind, [string, string]> = {
  confirmation: ["Order {n} confirmed", "تم تأكيد الطلب {n}"],
  shipped: ["Your order {n} is on the way", "طلبك {n} في الطريق"],
  delivered: ["Order {n} delivered", "تم توصيل الطلب {n}"],
  refunded: ["Refund issued for order {n}", "تم استرداد مبلغ الطلب {n}"],
  cancelled: ["Order {n} cancelled", "تم إلغاء الطلب {n}"],
};

export async function sendOrderEmail(order: Order & { items: OrderItem[] }, kind: Kind) {
  const s = await getSettings();
  const n = s.notifications;
  if (kind === "confirmation" && !n.orderConfirmation) return;
  if (kind === "shipped" && !n.shippingConfirmation) return;
  if (kind === "delivered" && !n.deliveryConfirmation) return;
  if (kind === "refunded" && !n.refundNotification) return;
  const ar = order.locale === "ar";
  const subject = subjects[kind][ar ? 1 : 0].replace("{n}", order.number);
  const rows = order.items.map((i) => `<tr><td style="padding:6px 0">${i.name}${i.variantTitle ? ` <span style="color:#64748b">(${i.variantTitle})</span>` : ""} × ${i.quantity}</td><td style="text-align:right">AED ${((i.price + i.warrantyPrice) * i.quantity).toFixed(2)}</td></tr>`).join("");
  const tracking = order.trackingNumber ? `<p><b>${ar ? "رقم التتبع" : "Tracking"}:</b> ${order.trackingCompany ?? ""} ${order.trackingNumber} ${order.trackingUrl ? `<a href="${order.trackingUrl}">${ar ? "تتبع" : "Track"}</a>` : ""}</p>` : "";
  const intro: Record<Kind, string> = {
    confirmation: ar ? `شكرًا لطلبك يا ${order.fullName}! سنخبرك عند شحنه.` : `Thanks for your order, ${order.fullName}! We'll let you know when it ships.`,
    shipped: ar ? "خبر سار! تم شحن طلبك." : "Good news! Your order has shipped.",
    delivered: ar ? "تم توصيل طلبك. نتمنى أن تستمتع به!" : "Your order was delivered. Enjoy!",
    refunded: ar ? `تم استرداد مبلغ ${order.refundedAmount} درهم.` : `A refund of AED ${order.refundedAmount} has been issued to your original payment method.`,
    cancelled: ar ? "تم إلغاء طلبك." : "Your order has been cancelled.",
  };
  const html = `<h2 style="margin:0 0 8px">${subject}</h2><p>${intro[kind]}</p>${tracking}
<table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">${rows}
<tr><td style="border-top:1px solid #e2e8f0;padding-top:8px"><b>${ar ? "الإجمالي" : "Total"}</b></td><td style="border-top:1px solid #e2e8f0;padding-top:8px;text-align:right"><b>AED ${order.total.toFixed(2)}</b></td></tr></table>
${btn(orderUrl(order.number), ar ? "عرض الطلب" : "View order")}`;
  await sendEmail(order.email, subject, html, `order_${kind}`);
  await orderEvent(order.id, "email", `${kind} email sent to ${order.email}`);
  if (kind === "confirmation" && n.staffOrderAlert && n.staffEmail)
    await sendEmail(n.staffEmail, `[${s.storeName}] New order ${order.number}: AED ${order.total}`, html, "staff_new_order");
}

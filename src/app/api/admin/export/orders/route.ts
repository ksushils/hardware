import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { csvResponse, orderWhere, type SP } from "@/components/admin/sales/queries";

export async function GET(req: Request) {
  const user = await getUser();
  if (!hasPermission(user, "orders")) return new Response("Forbidden", { status: 403 });
  const sp: SP = Object.fromEntries(new URL(req.url).searchParams);
  const orders = await db.order.findMany({ where: orderWhere(sp), orderBy: { createdAt: "desc" }, include: { items: true }, take: 10000 });
  const rows: (string | number | null)[][] = [[
    "Order", "Created at", "Status", "Payment status", "Fulfillment status", "Payment method", "Email", "Name", "Phone", "Emirate", "Area", "Street", "Building",
    "Subtotal", "Discount code", "Discount", "Shipping", "COD fee", "Gift card", "VAT", "Total", "Refunded", "Shipping method", "Tracking", "Tags", "Lineitem name", "Lineitem variant", "Lineitem SKU", "Lineitem qty", "Lineitem price",
  ]];
  for (const o of orders) {
    o.items.forEach((i, idx) => {
      const head = idx === 0
        ? [o.number, o.createdAt.toISOString(), o.status, o.paymentStatus, o.fulfillmentStatus, o.paymentMethod, o.email, o.fullName, o.phone, o.emirate, o.area, o.street, o.building,
          o.subtotal, o.discountCode ?? o.discountTitle ?? "", o.discount, o.shipping, o.codFee, o.giftCardAmount, o.vat, o.total, o.refundedAmount, o.shippingRateName, o.trackingNumber ?? "", o.tags]
        : [o.number, ...Array(24).fill("")];
      rows.push([...head, i.name, i.variantTitle, i.sku ?? "", i.quantity, i.price]);
    });
  }
  return csvResponse("orders", rows);
}

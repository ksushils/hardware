import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { csvResponse, customerWhere, type SP } from "@/components/admin/sales/queries";
import { customerStats } from "@/components/admin/sales/customerStats";

export async function GET(req: Request) {
  const user = await getUser();
  if (!hasPermission(user, "customers")) return new Response("Forbidden", { status: 403 });
  const sp: SP = Object.fromEntries(new URL(req.url).searchParams);
  const customers = await db.user.findMany({ where: customerWhere(sp), orderBy: { createdAt: "desc" }, include: { addresses: { orderBy: { isDefault: "desc" }, take: 1 } }, take: 20000 });
  const stats = await customerStats(customers.map((c) => c.id));
  const rows: (string | number | null)[][] = [["Name", "Email", "Phone", "Accepts marketing", "Language", "Emirate", "Area", "Orders", "Total spent", "Tags", "Note", "Disabled", "Created at"]];
  for (const c of customers) {
    const a = c.addresses[0];
    const st = stats.get(c.id);
    rows.push([c.name, c.email, c.phone ?? "", c.acceptsMarketing ? "yes" : "no", c.locale, a?.emirate ?? "", a?.area ?? "", st?.orders ?? 0, st?.spent ?? 0, c.tags, c.note ?? "", c.disabled ? "yes" : "no", c.createdAt.toISOString()]);
  }
  return csvResponse("customers", rows);
}

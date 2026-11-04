import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { csvResponse } from "@/components/admin/sales/queries";

export async function GET(req: Request) {
  const user = await getUser();
  if (!hasPermission(user, "customers")) return new Response("Forbidden", { status: 403 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().toLowerCase();
  const subs = await db.subscriber.findMany({ where: q ? { email: { contains: q } } : {}, orderBy: { createdAt: "desc" } });
  return csvResponse("subscribers", [["Email", "Language", "Source", "Subscribed at"], ...subs.map((s) => [s.email, s.locale, s.source, s.createdAt.toISOString()])]);
}

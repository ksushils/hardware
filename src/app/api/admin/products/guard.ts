import { getUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export async function productsGuard() {
  const user = await getUser();
  return user && hasPermission(user, "products") ? user : null;
}
export const forbidden = () => Response.json({ error: "Forbidden" }, { status: 403 });

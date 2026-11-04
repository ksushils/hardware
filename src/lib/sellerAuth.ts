import "server-only";
import { redirect } from "next/navigation";
import { db } from "./db";
import { getUser } from "./auth";

/** Logged-in user's seller record (any status), or null. */
export async function getSellerForUser() {
  const user = await getUser();
  if (!user) return { user: null, seller: null };
  const seller = await db.seller.findUnique({ where: { userId: user.id } });
  return { user, seller };
}

/**
 * Guard for the seller portal and seller actions. Only APPROVED sellers get through;
 * pending/rejected/suspended sellers are sent to the status page, others to the application.
 */
export async function requireSeller() {
  const { user, seller } = await getSellerForUser();
  if (!user) redirect("/login?next=/seller");
  if (!seller) redirect("/become-a-seller");
  if (seller.status !== "APPROVED") redirect("/seller/status");
  return { user, seller };
}

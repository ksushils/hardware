// Staff permission keys. ADMIN (store owner) implicitly has all of them.
export const PERMISSIONS = {
  orders: "Orders, drafts, returns & abandoned checkouts",
  products: "Products, collections, inventory, gift cards & reviews",
  customers: "Customers & subscribers",
  discounts: "Discounts",
  content: "Online store: pages, blog, navigation & media",
  analytics: "Analytics & reports",
  settings: "Store settings, shipping, payments & notifications",
  staff: "Staff accounts & permissions",
  sellers: "Marketplace: sellers, commissions & payouts",
} as const;
export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(user: { role: string; permissions: string } | null | undefined, perm: Permission) {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  if (user.role !== "STAFF") return false;
  return user.permissions.split(",").map((s) => s.trim()).includes(perm);
}
export const isStaff = (user: { role: string } | null | undefined) => !!user && (user.role === "ADMIN" || user.role === "STAFF");

import { db } from "@/lib/db";

let n = 0;
const uid = () => `${Date.now().toString(36)}${(n++).toString(36)}`;

export async function makeCategory() {
  const id = uid();
  return db.category.create({ data: { slug: `cat-${id}`, name: `Cat ${id}`, icon: "gpu" } });
}

export async function makeProduct(opts: { sellerId?: string | null; stock?: number; price?: number; trackInventory?: boolean } = {}) {
  const cat = await makeCategory();
  const id = uid();
  return db.product.create({
    data: {
      slug: `p-${id}`, name: `Product ${id}`, brand: "Test", categoryId: cat.id, priceNew: 1000, sellerId: opts.sellerId ?? null,
      options: { create: [{ name: "Condition", values: JSON.stringify(["Good"]) }] },
      variants: { create: [{ title: "Good", option1: "Good", price: opts.price ?? 500, stock: opts.stock ?? 5, sku: `SKU-${id}`, sellerId: opts.sellerId ?? null, trackInventory: opts.trackInventory ?? true }] },
    },
    include: { variants: true },
  });
}

export async function makeUser(role = "CUSTOMER") {
  const id = uid();
  return db.user.create({ data: { email: `u-${id}@test.local`, name: `User ${id}`, password: "x", role } });
}

export async function makeSeller(status = "APPROVED") {
  const user = await makeUser();
  const id = uid();
  return db.seller.create({ data: { userId: user.id, shopName: `Shop ${id}`, slug: `shop-${id}`, status, email: user.email, phone: "0501234567", emirate: "Dubai" } });
}

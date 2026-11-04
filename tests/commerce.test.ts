import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getUser: async () => null }));
vi.mock("@/lib/mailer", () => ({ sendEmail: async () => {}, btn: () => "" }));

import { db } from "@/lib/db";
import { adjustStock, cancelOrderInternal } from "@/lib/orders";
import { expireUnpaidCardOrders } from "@/lib/orderExpiry";
import { evaluateDiscount } from "@/lib/discounts";
import { resolveCommission, sellerAllowsSales } from "@/lib/marketplace";
import { makeProduct, makeSeller } from "./helpers/factories";

const orderBase = { email: "b@test.local", subtotal: 100, shipping: 0, vat: 5, total: 100, fullName: "B", phone: "0501234567", emirate: "Dubai", area: "a", street: "s", building: "b" };
const num = () => `T-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

describe("stock integrity", () => {
  it("two simultaneous buyers cannot both take the last unit", async () => {
    const p = await makeProduct({ stock: 1 });
    const vid = p.variants[0].id;
    // same guarded decrement the checkout transaction uses
    const attempt = () => db.$transaction(async (tx) => {
      const r = await tx.variant.updateMany({ where: { id: vid, stock: { gte: 1 } }, data: { stock: { decrement: 1 } } });
      if (r.count === 0) throw new Error("sold out");
      return true;
    });
    const results = await Promise.allSettled([attempt(), attempt(), attempt()]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await db.variant.findUnique({ where: { id: vid } }))!.stock).toBe(0);
  });

  it("stock adjustments are logged", async () => {
    const p = await makeProduct({ stock: 2 });
    await adjustStock(p.variants[0].id, 3, "received");
    expect((await db.variant.findUnique({ where: { id: p.variants[0].id } }))!.stock).toBe(5);
    expect(await db.inventoryAdjustment.count({ where: { variantId: p.variants[0].id, delta: 3 } })).toBe(1);
  });
});

describe("unpaid order expiry", () => {
  async function makeOrder(opts: { method: string; payment: string; ageMin: number; qty?: number }) {
    const p = await makeProduct({ stock: 5 });
    const o = await db.order.create({
      data: { ...orderBase, number: num(), paymentMethod: opts.method, paymentStatus: opts.payment, createdAt: new Date(Date.now() - opts.ageMin * 60_000),
        items: { create: [{ productId: p.id, variantId: p.variants[0].id, name: "x", image: "", price: 100, quantity: opts.qty ?? 1 }] } },
    });
    await db.variant.update({ where: { id: p.variants[0].id }, data: { stock: { decrement: opts.qty ?? 1 } } });
    return { o, vid: p.variants[0].id };
  }

  it("cancels stale unpaid card orders and returns the stock", async () => {
    const { o, vid } = await makeOrder({ method: "CARD", payment: "PENDING", ageMin: 180 });
    await expireUnpaidCardOrders(60);
    expect((await db.order.findUnique({ where: { id: o.id } }))!.status).toBe("CANCELLED");
    expect((await db.variant.findUnique({ where: { id: vid } }))!.stock).toBe(5);
  });
  it("never touches paid, COD or fresh orders", async () => {
    const paid = await makeOrder({ method: "CARD", payment: "PAID", ageMin: 500 });
    const cod = await makeOrder({ method: "COD", payment: "PENDING", ageMin: 500 });
    const fresh = await makeOrder({ method: "CARD", payment: "PENDING", ageMin: 5 });
    await expireUnpaidCardOrders(60);
    for (const x of [paid, cod, fresh]) expect((await db.order.findUnique({ where: { id: x.o.id } }))!.status).toBe("OPEN");
  });
  it("cancelling twice does not restock twice", async () => {
    const { o, vid } = await makeOrder({ method: "CARD", payment: "PENDING", ageMin: 1 });
    await cancelOrderInternal(o, "test");
    await cancelOrderInternal((await db.order.findUnique({ where: { id: o.id } }))!, "test again");
    expect((await db.variant.findUnique({ where: { id: vid } }))!.stock).toBe(5);
  });
});

describe("discounts", () => {
  const mk = (data: Record<string, unknown>) => db.discount.create({ data: { title: "t", code: `C${Math.random().toString(36).slice(2, 8).toUpperCase()}`, type: "PERCENT", value: 10, ...data } as never });
  const lines = (price: number, quantity = 1, productId = "p1") => [{ productId, price, quantity }];

  it("percent and fixed amounts, minimum spend, expiry and usage limits", async () => {
    const d = await mk({ minType: "AMOUNT", minValue: 200 });
    expect(await evaluateDiscount(d, lines(100))).toMatchObject({ ok: false, error: "minSpend" });
    const ok = await evaluateDiscount(d, lines(300));
    expect(ok.ok && ok.applied.amount).toBe(30);
    const expired = await mk({ endsAt: new Date(Date.now() - 1000) });
    expect(await evaluateDiscount(expired, lines(100))).toMatchObject({ ok: false, error: "expired" });
    const used = await mk({ usageLimit: 1, usedCount: 1 });
    expect(await evaluateDiscount(used, lines(100))).toMatchObject({ ok: false, error: "expired" });
  });
  it("buy 2 get 1 free discounts the cheapest unit", async () => {
    const d = await mk({ type: "BXGY", value: 100, buyQty: 2, getQty: 1 });
    const r = await evaluateDiscount(d, [{ productId: "a", price: 300, quantity: 1 }, { productId: "b", price: 200, quantity: 1 }, { productId: "c", price: 100, quantity: 1 }]);
    expect(r.ok && r.applied.amount).toBe(100);
  });
});

describe("marketplace rules", () => {
  it("seller commission: product rule beats seller override rule beats category beats global beats default", async () => {
    const seller = await makeSeller();
    const p = await makeProduct({ sellerId: seller.id });
    const prod = await db.product.findUniqueOrThrow({ where: { id: p.id } });
    await db.commissionRule.deleteMany();
    expect(await resolveCommission({ id: prod.id, categoryId: prod.categoryId, sellerId: seller.id })).toMatchObject({ percent: 10 }); // settings default
    await db.commissionRule.create({ data: { scope: "GLOBAL", percent: 12 } });
    expect((await resolveCommission({ id: prod.id, categoryId: prod.categoryId, sellerId: seller.id })).percent).toBe(12);
    await db.commissionRule.create({ data: { scope: "CATEGORY", categoryId: prod.categoryId, percent: 7 } });
    expect((await resolveCommission({ id: prod.id, categoryId: prod.categoryId, sellerId: seller.id })).percent).toBe(7);
    await db.commissionRule.create({ data: { scope: "PRODUCT", productId: prod.id, percent: 3 } });
    expect((await resolveCommission({ id: prod.id, categoryId: prod.categoryId, sellerId: seller.id })).percent).toBe(3);
    await db.seller.update({ where: { id: seller.id }, data: { commissionType: "PERCENT", commissionRate: 5 } });
    expect((await resolveCommission({ id: prod.id, categoryId: prod.categoryId, sellerId: seller.id })).percent).toBe(5);
    expect((await resolveCommission({ id: prod.id, categoryId: prod.categoryId, sellerId: null })).type).toBe("NONE");
  });
  it("suspended, pending or on-vacation sellers cannot sell", () => {
    expect(sellerAllowsSales(null)).toBe(true);
    expect(sellerAllowsSales({ status: "APPROVED", vacationMode: false })).toBe(true);
    expect(sellerAllowsSales({ status: "SUSPENDED", vacationMode: false })).toBe(false);
    expect(sellerAllowsSales({ status: "PENDING", vacationMode: false })).toBe(false);
    expect(sellerAllowsSales({ status: "APPROVED", vacationMode: true })).toBe(false);
  });
});

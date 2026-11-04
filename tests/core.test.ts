import { describe, expect, it } from "vitest";
import { computeTotals, warrantyPrice } from "@/lib/pricing";
import { rateLimit } from "@/lib/rateLimit";
import { renderMarkdown } from "@/lib/markdown";
import { orderAccessKey, verifyOrderKey } from "@/lib/orderAccess";
import { offerSnapshots } from "@/lib/offerSnapshots";
import { commissionFor } from "@/lib/marketplace";
import { luhn } from "@/lib/payments";

describe("pricing", () => {
  const lines = [{ price: 1000, quantity: 2, warranty: false }, { price: 500, quantity: 1, warranty: true }];
  it("adds Care+ per unit and extracts VAT from VAT-inclusive prices", () => {
    const t = computeTotals(lines, { rate: { price: 15, freeAbove: 200 } });
    expect(t.subtotal).toBe(2000 + 500 + warrantyPrice(500));
    expect(t.shipping).toBe(0); // free over threshold
    expect(t.vat).toBeCloseTo(t.total - t.total / 1.05, 2);
  });
  it("never lets a discount exceed the subtotal and never goes negative", () => {
    const t = computeTotals([{ price: 100, quantity: 1, warranty: false }], { discount: 9999, rate: { price: 15, freeAbove: null } });
    expect(t.discount).toBe(100);
    expect(t.total).toBe(15);
  });
  it("applies a gift card last and cannot exceed what is due", () => {
    const t = computeTotals([{ price: 100, quantity: 1, warranty: false }], { giftCardBalance: 500 });
    expect(t.giftCard).toBe(t.gross);
    expect(t.total).toBe(0);
  });
  it("adds the COD fee only for COD", () => {
    const base = computeTotals([{ price: 100, quantity: 1, warranty: false }], { paymentMethod: "CARD" });
    const cod = computeTotals([{ price: 100, quantity: 1, warranty: false }], { paymentMethod: "COD" });
    expect(cod.total - base.total).toBe(cod.codFee);
  });
});

describe("rate limiter", () => {
  it("allows up to the limit then blocks", () => {
    const key = `test:${Math.random()}`;
    const results = Array.from({ length: 7 }, () => rateLimit(key, 5, 60));
    expect(results.filter(Boolean)).toHaveLength(5);
  });
  it("is per key", () => {
    expect(rateLimit("a:" + Math.random(), 1, 60)).toBe(true);
    expect(rateLimit("b:" + Math.random(), 1, 60)).toBe(true);
  });
});

describe("markdown", () => {
  it("escapes HTML so CMS/blog content cannot inject scripts", () => {
    const html = renderMarkdown('## Hi\n<script>alert(1)</script> [x](javascript:alert(1)) **b**');
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain("<strong>b</strong>");
  });
});

describe("order access keys", () => {
  it("verifies only the key for that order", () => {
    const k = orderAccessKey("TR1-AAAAA");
    expect(verifyOrderKey("TR1-AAAAA", k)).toBe(true);
    expect(verifyOrderKey("TR1-BBBBB", k)).toBe(false);
    expect(verifyOrderKey("TR1-AAAAA", "forged")).toBe(false);
    expect(verifyOrderKey("TR1-AAAAA", null)).toBe(false);
  });
});

describe("offer snapshots", () => {
  const v = { title: "Good", conditionType: "REFURBISHED", cosmeticGrade: "Good", functionalStatus: null, batteryHealth: 88, batteryCycles: null, repairDisclosure: null, accessories: "Charger", verification: "SELLER_DECLARED", testedAt: null, testedBy: null, warrantyProvider: null, warrantyMonths: null, warrantyTerms: null, returnDays: null, returnTerms: null };
  it("applies store defaults when the offer sets no terms and labels the seller", () => {
    const s = offerSnapshots(v as never, { shopName: "GPU Souq" }, { warrantyMonths: 12, returnDays: 14, storeName: "TechRevive" });
    expect(s.sellerName).toBe("GPU Souq");
    expect(JSON.parse(s.warrantySnapshot)).toMatchObject({ provider: "SELLER", months: 12 });
    expect(JSON.parse(s.returnSnapshot)).toMatchObject({ days: 14 });
    expect(JSON.parse(s.conditionSnapshot)).toMatchObject({ batteryHealth: 88, verification: "SELLER_DECLARED" });
  });
  it("never labels a seller warranty as the store's", () => {
    const s = offerSnapshots(v as never, null, { warrantyMonths: 12, returnDays: 14, storeName: "TechRevive" });
    expect(JSON.parse(s.warrantySnapshot).provider).toBe("KARAT");
  });
});

describe("commission", () => {
  it("percent, fixed and combined rules, capped at the line total", () => {
    expect(commissionFor({ type: "PERCENT", percent: 10, fixed: 0 }, 500, 2)).toEqual({ amount: 100, earning: 900 });
    expect(commissionFor({ type: "FIXED", percent: 0, fixed: 25 }, 500, 2)).toEqual({ amount: 50, earning: 950 });
    expect(commissionFor({ type: "FIXED_PERCENT", percent: 5, fixed: 10 }, 100, 1)).toEqual({ amount: 15, earning: 85 });
    expect(commissionFor({ type: "FIXED", percent: 0, fixed: 999 }, 10, 1)).toEqual({ amount: 10, earning: 0 });
  });
});

describe("demo card validation", () => {
  it("luhn accepts valid test cards and rejects bad numbers", () => {
    expect(luhn("4242 4242 4242 4242")).toBe(true);
    expect(luhn("4242 4242 4242 4241")).toBe(false);
  });
});

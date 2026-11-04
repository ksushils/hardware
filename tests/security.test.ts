import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// canReadFile calls getUser() (cookies). Stub it so we can test authorization per user.
let currentUser: { id: string; role: string; permissions: string } | null = null;
vi.mock("@/lib/auth", () => ({ getUser: async () => currentUser }));

import { db } from "@/lib/db";
import { canReadFile, savePrivateFile, signFileUrl, PRIVATE_DIR } from "@/lib/privateStorage";
import { makeSeller, makeUser } from "./helpers/factories";

const pdf = () => new File([Buffer.from("%PDF-1.4\n%test")], "licence.pdf", { type: "application/pdf" });

describe("private file storage", () => {
  it("stores outside the public folder with an unguessable key", async () => {
    const seller = await makeSeller();
    const f = await savePrivateFile(pdf(), { ownerType: "SELLER_DOC", ownerId: seller.id });
    expect(PRIVATE_DIR()).not.toContain(`${path.sep}public`);
    expect(f.storageKey).toMatch(/^[a-z0-9]+-[a-f0-9]{24}$/);
    expect(readFileSync(path.join(PRIVATE_DIR(), f.storageKey)).toString()).toContain("%PDF-");
  });

  it("rejects files whose content does not match an allowed type, whatever the name/MIME claims", async () => {
    const fake = new File([Buffer.from("<html><script>alert(1)</script></html>")], "licence.pdf", { type: "application/pdf" });
    await expect(savePrivateFile(fake, { ownerType: "SELLER_DOC" })).rejects.toThrow(/PDF, PNG, JPG or WebP/);
    const exe = new File([Buffer.from("MZ\x90\x00")], "a.png", { type: "image/png" });
    await expect(savePrivateFile(exe, { ownerType: "SELLER_DOC" })).rejects.toThrow();
  });

  it("enforces size limits", async () => {
    const big = new File([Buffer.alloc(11 * 1024 * 1024, 0x25)], "big.pdf", { type: "application/pdf" });
    await expect(savePrivateFile(big, { ownerType: "SELLER_DOC" })).rejects.toThrow(/too large/);
  });

  it("licence documents: owner and permitted staff can read; other sellers, buyers and anonymous cannot", async () => {
    const a = await makeSeller(), b = await makeSeller();
    const file = await savePrivateFile(pdf(), { ownerType: "SELLER_DOC", ownerId: a.id });
    const ref = { id: file.id, ownerType: file.ownerType, ownerId: file.ownerId };
    currentUser = null;
    expect(await canReadFile(ref, null, null)).toBe(false);
    currentUser = { id: a.userId, role: "CUSTOMER", permissions: "" };
    expect(await canReadFile(ref, null, null)).toBe(true);
    currentUser = { id: b.userId, role: "CUSTOMER", permissions: "" };
    expect(await canReadFile(ref, null, null)).toBe(false);
    const buyer = await makeUser();
    currentUser = { id: buyer.id, role: "CUSTOMER", permissions: "" };
    expect(await canReadFile(ref, null, null)).toBe(false);
    const staffNo = await makeUser("STAFF");
    currentUser = { id: staffNo.id, role: "STAFF", permissions: "orders" };
    expect(await canReadFile(ref, null, null)).toBe(false); // staff without the "sellers" permission
    currentUser = { id: staffNo.id, role: "STAFF", permissions: "sellers" };
    expect(await canReadFile(ref, null, null)).toBe(true);
    currentUser = null;
  });

  it("signed links work, expire and cannot be reused for another file", async () => {
    const a = await makeSeller();
    const f1 = await savePrivateFile(pdf(), { ownerType: "SELLER_DOC", ownerId: a.id });
    const f2 = await savePrivateFile(pdf(), { ownerType: "SELLER_DOC", ownerId: a.id });
    currentUser = null;
    const q = new URL("http://x" + signFileUrl(f1.id, 60)).searchParams;
    expect(await canReadFile(f1, q.get("exp"), q.get("sig"))).toBe(true);
    expect(await canReadFile(f2, q.get("exp"), q.get("sig"))).toBe(false);
    const expired = new URL("http://x" + signFileUrl(f1.id, -5)).searchParams;
    expect(await canReadFile(f1, expired.get("exp"), expired.get("sig"))).toBe(false);
  });
});

describe("verified-purchase reviews", () => {
  it("only reviewers with a paid/delivered, non-cancelled order of the product qualify", async () => {
    const { makeProduct } = await import("./helpers/factories");
    const p = await makeProduct();
    const buyer = await makeUser(), stranger = await makeUser();
    const base = { email: "b@test.local", paymentMethod: "COD", subtotal: 1, shipping: 0, vat: 0, total: 1, fullName: "B", phone: "0", emirate: "Dubai", area: "a", street: "s", building: "b" };
    await db.order.create({ data: { ...base, number: `T-${Math.random().toString(36).slice(2, 8)}`, userId: buyer.id, paymentStatus: "PAID", items: { create: [{ productId: p.id, variantId: p.variants[0].id, name: "x", image: "", price: 1, quantity: 1 }] } } });
    const q = (uid: string) => db.orderItem.findFirst({ where: { productId: p.id, order: { userId: uid, status: { notIn: ["CANCELLED", "DRAFT"] }, OR: [{ paymentStatus: "PAID" }, { fulfillmentStatus: "DELIVERED" }] } } });
    expect(await q(buyer.id)).not.toBeNull();
    expect(await q(stranger.id)).toBeNull();
  });
});

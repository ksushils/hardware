import type { PrismaClient } from "@prisma/client";

/**
 * DEMO FIXTURES: extra seller offers on existing canonical store products, so product pages show several offers.
 * Idempotent (offers are keyed by SKU). Everything here is demo data, including the one "verified" offer.
 * Needs the demo sellers from seed.ts (seller1@example.com = GPU Souq, seller2@example.com = Sharjah PC Hub).
 */
type Offer = {
  seller: "seller1@example.com" | "seller2@example.com"; slug: string; opts: string[]; price: number; stock: number; status?: string;
  conditionType: string; cosmeticGrade?: string; functionalStatus?: string; batteryHealth?: number; batteryCycles?: number; repairDisclosure?: string; accessories?: string;
  verification?: "NONE" | "SELLER_DECLARED" | "PLATFORM_VERIFIED"; testedDaysAgo?: number; testedBy?: string; testNotes?: string; photos?: string[];
  warrantyProvider?: string; warrantyMonths?: number; warrantyTerms?: string; returnDays?: number; handlingDays?: number;
};

const OFFERS: Offer[] = [
  // ── RTX 4070 Super: four competing offers (store has New/Excellent/Very Good/Good already)
  { seller: "seller1@example.com", slug: "nvidia-geforce-rtx-4070-super-12gb", opts: ["Excellent"], price: 1949, stock: 2, conditionType: "REFURBISHED", cosmeticGrade: "Excellent",
    functionalStatus: "Fully tested: 2-hour stress test passed", repairDisclosure: "Thermal paste replaced. No other repairs.", accessories: "Original box, PCIe power adapter",
    verification: "PLATFORM_VERIFIED", testedDaysAgo: 6, testedBy: "DEMO FIXTURE", testNotes: "Demo data. Not a real inspection.", photos: ["/img/gpu.svg", "/img/cooling.svg"],
    warrantyProvider: "SELLER", warrantyMonths: 12, warrantyTerms: "Covers functional defects. Excludes physical or liquid damage and modification.", returnDays: 14, handlingDays: 1 },
  { seller: "seller1@example.com", slug: "nvidia-geforce-rtx-4070-super-12gb", opts: ["Very Good"], price: 1849, stock: 1, conditionType: "REFURBISHED", cosmeticGrade: "Very Good",
    functionalStatus: "Tested, all outputs working", verification: "SELLER_DECLARED", testedDaysAgo: 20, testedBy: "GPU Souq bench", warrantyProvider: "SELLER", warrantyMonths: 6, handlingDays: 2 },
  { seller: "seller2@example.com", slug: "nvidia-geforce-rtx-4070-super-12gb", opts: ["Very Good"], price: 1929, stock: 3, conditionType: "REFURBISHED", cosmeticGrade: "Very Good",
    functionalStatus: "Tested under load, temperatures within spec", repairDisclosure: "None", accessories: "Card only", verification: "SELLER_DECLARED", testedDaysAgo: 3, testedBy: "Sharjah PC Hub lab",
    warrantyProvider: "SELLER", warrantyMonths: 12, returnDays: 21, handlingDays: 1 },
  { seller: "seller2@example.com", slug: "nvidia-geforce-rtx-4070-super-12gb", opts: ["Brand New"], price: 2449, stock: 4, conditionType: "NEW", warrantyProvider: "MANUFACTURER", warrantyMonths: 24, handlingDays: 1 },
  // pending moderation (shows in the admin queue)
  { seller: "seller2@example.com", slug: "nvidia-geforce-rtx-3080-10gb", opts: ["Very Good"], price: 1299, stock: 2, status: "PENDING", conditionType: "USED", cosmeticGrade: "Very Good",
    functionalStatus: "Works, fan tested", verification: "SELLER_DECLARED", warrantyProvider: "SELLER", warrantyMonths: 3, handlingDays: 2 },
  { seller: "seller1@example.com", slug: "nvidia-geforce-rtx-3080-10gb", opts: ["Good"], price: 1099, stock: 1, conditionType: "USED", cosmeticGrade: "Good", functionalStatus: "Works; minor scuffs on the shroud",
    repairDisclosure: "None disclosed", warrantyProvider: "SELLER", warrantyMonths: 3, handlingDays: 1 },
  // ── CPU
  { seller: "seller1@example.com", slug: "amd-ryzen-7-7800x3d", opts: ["Excellent"], price: 1349, stock: 2, conditionType: "REFURBISHED", cosmeticGrade: "Excellent", functionalStatus: "Tested on AM5 board, 3 benchmark passes",
    accessories: "Chip only", verification: "SELLER_DECLARED", testedDaysAgo: 10, warrantyProvider: "SELLER", warrantyMonths: 12, handlingDays: 1 },
  // ── Laptop with battery evidence and several unit photos
  { seller: "seller2@example.com", slug: "asus-rog-strix-g16-i9-13980hx-rtx-4070", opts: ["Very Good"], price: 4499, stock: 1, conditionType: "REFURBISHED", cosmeticGrade: "Very Good",
    functionalStatus: "All keys, ports, camera and speakers tested", batteryHealth: 91, batteryCycles: 142, repairDisclosure: "Fans cleaned, thermal paste replaced", accessories: "330W charger, original box",
    verification: "SELLER_DECLARED", testedDaysAgo: 2, testedBy: "Sharjah PC Hub lab", photos: ["/img/laptop.svg", "/img/laptop.svg"], warrantyProvider: "SELLER", warrantyMonths: 12, returnDays: 14, handlingDays: 1 },
  // ── SSD with two options (Condition + Capacity)
  { seller: "seller2@example.com", slug: "samsung-990-pro-nvme-m-2-ssd", opts: ["Excellent", "2TB"], price: 559, stock: 3, conditionType: "REFURBISHED", cosmeticGrade: "Excellent",
    functionalStatus: "SMART health 98%, full surface test", repairDisclosure: "None", verification: "SELLER_DECLARED", testedDaysAgo: 4, testedBy: "Sharjah PC Hub lab", warrantyProvider: "SELLER", warrantyMonths: 12, handlingDays: 1 },
];

export async function seedOffers(db: PrismaClient) {
  const sellers = new Map<string, string>();
  for (const email of ["seller1@example.com", "seller2@example.com"]) {
    const s = await db.seller.findFirst({ where: { user: { email } }, select: { id: true } });
    if (s) sellers.set(email, s.id);
  }
  let made = 0;
  for (const o of OFFERS) {
    const sellerId = sellers.get(o.seller);
    const product = await db.product.findUnique({ where: { slug: o.slug } });
    if (!sellerId || !product) continue;
    const sku = `DEMO-${o.slug}-${o.seller.slice(0, 7)}-${o.opts.join("").replace(/\W/g, "")}`.toUpperCase();
    if (await db.variant.findUnique({ where: { sku } })) continue;
    const [option1, option2 = null, option3 = null] = o.opts;
    await db.variant.create({
      data: {
        productId: product.id, sellerId, sku, title: o.opts.join(" / "), option1, option2, option3, price: o.price, stock: o.stock, position: await db.variant.count({ where: { productId: product.id } }),
        approvalStatus: o.status ?? "APPROVED", conditionType: o.conditionType, cosmeticGrade: o.cosmeticGrade ?? null, functionalStatus: o.functionalStatus ?? null,
        batteryHealth: o.batteryHealth ?? null, batteryCycles: o.batteryCycles ?? null, repairDisclosure: o.repairDisclosure ?? null, accessories: o.accessories ?? null,
        verification: o.verification ?? "NONE", testedAt: o.testedDaysAgo != null ? new Date(Date.now() - o.testedDaysAgo * 86400_000) : null, testedBy: o.testedBy ?? null, testNotes: o.testNotes ?? null,
        photos: JSON.stringify(o.photos ?? []), warrantyProvider: o.warrantyProvider ?? null, warrantyMonths: o.warrantyMonths ?? null, warrantyTerms: o.warrantyTerms ?? null,
        returnDays: o.returnDays ?? null, handlingDays: o.handlingDays ?? 1,
      },
    });
    made++;
  }
  console.log(`seedOffers: ${made} demo seller offers created`);
}

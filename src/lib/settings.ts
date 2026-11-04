import "server-only";
import { cache } from "react";
import { db } from "./db";

export type MenuItem = { label: string; labelAr: string; url: string };

export const DEFAULT_SETTINGS = {
  storeName: "TechRevive",
  storeNameAr: "تك ريفايف",
  legalName: "TechRevive Trading LLC",
  trn: "", // UAE VAT Tax Registration Number, printed on tax invoices
  email: "support@techrevive.ae",
  phone: "+971 4 000 0000",
  whatsapp: "971500000000",
  address: "Dubai, United Arab Emirates",
  addressAr: "دبي، الإمارات العربية المتحدة",
  hours: "Sun–Fri, 9:00–18:00",
  hoursAr: "الأحد–الجمعة، 9:00–18:00",
  currency: "AED",
  logoUrl: "",
  announcement: {
    enabled: true,
    text: "LIMITED OFFER: 10% off your first order with code WELCOME10",
    textAr: "عرض محدود: خصم 10% على طلبك الأول باستخدام الكود WELCOME10",
  },
  hero: {
    title: "Premium PC hardware.",
    titleAr: "قطع كمبيوتر احترافية.",
    highlight: "Up to 60% off new.",
    highlightAr: "وفّر حتى 60% مقارنة بالجديد.",
    subtitle: "GPUs, CPUs, SSDs, monitors and gaming PCs. Every part passes a 40-point inspection and comes with a 12-month warranty.",
    subtitleAr: "كروت شاشة، معالجات، أقراص SSD، شاشات وأجهزة ألعاب — كل قطعة تجتاز فحصًا من 40 نقطة مع ضمان 12 شهرًا.",
    videoUrl: "/video/hero.mp4",
    posterUrl: "/video/hero-poster.jpg",
    overlayOpacity: 60,
  },
  tax: { rate: 5, included: true, label: "VAT" },
  checkout: {
    guestCheckout: true,
    cardEnabled: true,
    codEnabled: true,
    codFee: 10,
    codMax: 5000,
    orderNotes: true,
    marketingOptIn: true,
    bnplMessage: true,
  },
  warranty: { months: 12, carePlusPercent: 6, carePlusMin: 29, carePlusMonths: 24 },
  returnsDays: 14,
  social: { instagram: "", facebook: "", x: "", tiktok: "", youtube: "" },
  mainMenu: [] as MenuItem[], // extra header links (categories are listed automatically)
  footerMenu: [
    { label: "About Us", labelAr: "من نحن", url: "/pages/about" },
    { label: "Blog", labelAr: "المدونة", url: "/blog" },
    { label: "Sell / Trade-in", labelAr: "بِع أو استبدل", url: "/pages/sell" },
    { label: "Terms & Conditions", labelAr: "الشروط والأحكام", url: "/pages/terms" },
    { label: "Privacy Policy", labelAr: "سياسة الخصوصية", url: "/pages/privacy" },
  ] as MenuItem[],
  seo: {
    title: "TechRevive UAE: Certified Renewed & New PC Hardware",
    description: "Buy tested graphics cards, CPUs, SSDs, monitors, laptops and gaming PCs in Dubai and across the UAE. 12-month warranty, free delivery and 14-day returns.",
  },
  notifications: {
    orderConfirmation: true,
    shippingConfirmation: true,
    deliveryConfirmation: true,
    refundNotification: true,
    abandonedCart: true,
    backInStock: true,
    staffOrderAlert: true,
    staffEmail: "orders@techrevive.ae",
  },
  languages: { arabicEnabled: true, defaultLocale: "en" as "en" | "ar" },
  marketplace: {
    enabled: true,
    defaultCommissionPercent: 10, // used when no CommissionRule / seller override matches
    autoApproveSellers: false,
    autoApproveProducts: false,
    minPayout: 100,
    holdDays: 14, // earnings become withdrawable this many days after delivery (covers the return window)
    sellerTerms: "Sellers must hold a valid UAE trade licence, ship within 2 business days, honour TechRevive's 14-day return policy and a minimum 3-month warranty on renewed items.",
    sellerTermsAr: "يجب أن يمتلك البائع رخصة تجارية سارية في الإمارات، وأن يشحن خلال يومي عمل، وأن يلتزم بسياسة الإرجاع خلال 14 يومًا وضمان لا يقل عن 3 أشهر على المنتجات المُجددة.",
  },
};
export type StoreSettings = typeof DEFAULT_SETTINGS;

function deepMerge<T>(base: T, over: unknown): T {
  if (!over || typeof over !== "object" || Array.isArray(over)) return (over as T) ?? base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
    const b = (base as Record<string, unknown>)[k];
    out[k] = b && typeof b === "object" && !Array.isArray(b) ? deepMerge(b, v) : v;
  }
  return out as T;
}

/** Store settings merged over defaults. Cached per request. */
export const getSettings = cache(async (): Promise<StoreSettings> => {
  const row = await db.setting.findUnique({ where: { key: "store" } });
  if (!row) return DEFAULT_SETTINGS;
  try {
    return deepMerge(DEFAULT_SETTINGS, JSON.parse(row.value));
  } catch {
    return DEFAULT_SETTINGS;
  }
});

/** Deep-merges a partial patch into the stored settings. */
export async function updateSettings(patch: Partial<StoreSettings> | Record<string, unknown>) {
  const current = await getSettings();
  const next = deepMerge(current, patch);
  await db.setting.upsert({ where: { key: "store" }, update: { value: JSON.stringify(next) }, create: { key: "store", value: JSON.stringify(next) } });
  return next;
}

/** Subset of settings needed by client-side price calculations. */
export function pricingConfig(s: StoreSettings) {
  return {
    taxRate: s.tax.rate,
    codFee: s.checkout.codFee,
    carePlusPercent: s.warranty.carePlusPercent,
    carePlusMin: s.warranty.carePlusMin,
  };
}

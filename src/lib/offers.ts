// Offer logic shared by server and client code (no server-only imports).
// A `Variant` row IS a seller offer: same canonical product, different seller / condition / terms / price.

export type OfferSeller = {
  id: string; shopName: string; slug: string; status: string; vacationMode: boolean;
  vacationUntil?: Date | string | null; ratingAvg: number; ratingCount: number;
};

export type OfferLike = {
  id: string; title?: string; option1?: string | null; option2?: string | null; option3?: string | null;
  price: number; stock: number; trackInventory: boolean; continueSelling: boolean;
  sellerId?: string | null; approvalStatus?: string; seller?: OfferSeller | null;
  conditionType?: string | null; cosmeticGrade?: string | null; functionalStatus?: string | null;
  batteryHealth?: number | null; batteryCycles?: number | null; repairDisclosure?: string | null; accessories?: string | null;
  verification?: string; testedAt?: Date | string | null; testedBy?: string | null; testNotes?: string | null; photos?: string | string[];
  warrantyProvider?: string | null; warrantyMonths?: number | null; warrantyTerms?: string | null;
  returnDays?: number | null; returnTerms?: string | null; handlingDays?: number;
};

// ───────────── visibility ─────────────

/** Seller is approved and not on vacation (vacation ends automatically after vacationUntil). */
export function sellerOk(seller: Pick<OfferSeller, "status" | "vacationMode" | "vacationUntil"> | null | undefined) {
  if (!seller) return true; // sold by the store itself
  if (seller.status !== "APPROVED") return false;
  const until = seller.vacationUntil ? new Date(seller.vacationUntil) : null;
  return !(seller.vacationMode && (!until || until > new Date()));
}

/** Offer may be shown (approved, seller can sell). Sold-out offers are still "listed". */
export const offerListed = (v: Pick<OfferLike, "approvalStatus" | "seller">) => (v.approvalStatus ?? "APPROVED") === "APPROVED" && sellerOk(v.seller);
export const offerAvailable = (v: Pick<OfferLike, "stock" | "trackInventory" | "continueSelling">) => !v.trackInventory || v.continueSelling || v.stock > 0;
/** Can be bought right now: approved, seller allowed, in stock. (Product-level ACTIVE+APPROVED is enforced by catalog queries.) */
export const offerVisible = (v: OfferLike) => offerListed(v) && offerAvailable(v);
export const listedOffers = <T extends OfferLike>(vs: T[]) => vs.filter(offerListed);

// ───────────── condition vocabulary ─────────────

export const CONDITION_TYPES = ["NEW", "OPEN_BOX", "REFURBISHED", "USED", "PARTS"] as const;
export const CONDITION_TYPE_LABEL: Record<string, [string, string]> = {
  NEW: ["Brand new", "جديد"], OPEN_BOX: ["Open box", "علبة مفتوحة"], REFURBISHED: ["Refurbished", "مُجدد"], USED: ["Used", "مستعمل"], PARTS: ["Parts only", "قطع غيار فقط"],
};
export const WARRANTY_PROVIDER_LABEL: Record<string, [string, string]> = {
  SELLER: ["Seller warranty", "ضمان البائع"], MANUFACTURER: ["Manufacturer warranty", "ضمان الشركة المصنعة"], KARAT: ["TechRevive warranty", "ضمان تك ريفايف"], NONE: ["No warranty", "بدون ضمان"],
};
export const L = (pair: [string, string] | undefined, locale: string) => (pair ? (locale === "ar" ? pair[1] : pair[0]) : "");
export const schemaItemCondition = (t: string | null | undefined) =>
  t === "NEW" ? "https://schema.org/NewCondition" : t === "USED" || t === "PARTS" || t === "OPEN_BOX" ? (t === "OPEN_BOX" ? "https://schema.org/RefurbishedCondition" : "https://schema.org/UsedCondition") : "https://schema.org/RefurbishedCondition";

/**
 * Fills in commercial condition for legacy/store offers that predate the offer fields,
 * using the product's "Condition" option value (Brand New → NEW, any grade → REFURBISHED).
 */
export function effectiveCondition(v: OfferLike, conditionValue?: string | null) {
  const optNew = conditionValue === "Brand New";
  return {
    type: v.conditionType ?? (conditionValue ? (optNew ? "NEW" : "REFURBISHED") : null),
    grade: v.cosmeticGrade ?? (conditionValue && !optNew ? conditionValue : null),
  };
}

export function parsePhotos(v: Pick<OfferLike, "photos">): string[] {
  try {
    const p = Array.isArray(v.photos) ? v.photos : JSON.parse(v.photos ?? "[]");
    return Array.isArray(p) ? p.filter((x) => typeof x === "string" && (x.startsWith("/") || x.startsWith("https://"))) : [];
  } catch {
    return [];
  }
}

// ───────────── evidence labelling ─────────────

export type EvidenceLevel = "verified" | "declared" | "store" | "none";
/** Honest evidence label for one data point: not supplied → none; platform verified → verified; else declared by seller/store. */
export function evidenceLevel(v: Pick<OfferLike, "verification" | "sellerId" | "seller">, present: boolean): EvidenceLevel {
  if (!present) return "none";
  if (v.verification === "PLATFORM_VERIFIED") return "verified";
  return v.sellerId || v.seller ? "declared" : "store";
}
export const EVIDENCE_LABEL: Record<EvidenceLevel, [string, string]> = {
  verified: ["Verified by TechRevive", "تم التحقق بواسطة تك ريفايف"],
  declared: ["Seller-declared", "إقرار البائع"],
  store: ["Declared by TechRevive (not independently verified)", "إقرار تك ريفايف (غير مُتحقق منه بشكل مستقل)"],
  none: ["Not supplied", "غير متوفر"],
};

// ───────────── transparent ranking ─────────────

/** Maximum points per factor. The sum is 100. Published on /grading. */
export const WEIGHTS = { price: 40, condition: 20, warranty: 15, seller: 10, dispatch: 10, verification: 5 } as const;
export type Factor = keyof typeof WEIGHTS;
const TYPE_POINTS: Record<string, number> = { NEW: 18, OPEN_BOX: 15, REFURBISHED: 13, USED: 8, PARTS: 0 };
const GRADE_BONUS: Record<string, number> = { excellent: 2, "very good": 1, good: 0 };

export type Reason = "lowest_price" | "best_condition" | "longest_warranty" | "top_rated_seller" | "fast_dispatch" | "verified" | "direct_store";
export const REASON_TEXT: Record<Reason, [string, string]> = {
  lowest_price: ["Lowest price among these offers", "أقل سعر بين هذه العروض"],
  best_condition: ["Best condition", "أفضل حالة"],
  longest_warranty: ["Longest warranty", "أطول ضمان"],
  top_rated_seller: ["Highly rated seller", "بائع عالي التقييم"],
  fast_dispatch: ["Fast dispatch", "شحن سريع"],
  verified: ["Condition evidence verified by TechRevive", "أدلة الحالة مُتحقق منها من تك ريفايف"],
  direct_store: ["Sold directly by TechRevive", "يُباع مباشرة من تك ريفايف"],
};
export const FACTOR_TEXT: Record<Factor, [string, string, string, string]> = {
  price: ["Price", "السعر", "Lower prices score higher, relative to the cheapest offer.", "كلما انخفض السعر زادت النقاط مقارنة بأرخص عرض."],
  condition: ["Condition", "الحالة", "New > open box > refurbished > used; better cosmetic grade adds a little.", "جديد > علبة مفتوحة > مُجدد > مستعمل، والدرجة الشكلية الأفضل تضيف نقاطًا."],
  warranty: ["Warranty", "الضمان", "Longer warranty scores higher (up to 24 months).", "ضمان أطول يعني نقاطًا أعلى (حتى 24 شهرًا)."],
  seller: ["Seller rating", "تقييم البائع", "Buyer ratings (needs at least 3 ratings, otherwise neutral); TechRevive direct sales get a fixed score.", "تقييمات المشترين (3 تقييمات على الأقل وإلا محايد)، ومبيعات تك ريفايف المباشرة لها نقاط ثابتة."],
  dispatch: ["Dispatch time", "وقت التجهيز", "Faster handling time scores higher.", "كلما قل وقت التجهيز زادت النقاط."],
  verification: ["Evidence", "الأدلة", "Verified by TechRevive scores highest; seller-declared a little; none scores zero.", "التحقق من تك ريفايف أعلى نقاط، وإقرار البائع قليل، وبدون أدلة صفر."],
};

export type RankedOffer<T extends OfferLike> = { offer: T; score: number; parts: Record<Factor, number>; reasons: Reason[]; recommended: boolean };

export function rankOffers<T extends OfferLike>(offers: T[], opts: { warrantyDefaultMonths?: number; conditionOf?: (o: T) => string | null } = {}): RankedOffer<T>[] {
  const avail = offers.filter(offerAvailable);
  const pool = avail.length ? avail : offers;
  const minPrice = Math.min(...pool.map((o) => o.price));
  const parts = new Map<string, Record<Factor, number>>();
  for (const o of offers) {
    const { type, grade } = effectiveCondition(o, opts.conditionOf?.(o) ?? null);
    const months = o.warrantyProvider === "NONE" ? 0 : o.warrantyMonths ?? opts.warrantyDefaultMonths ?? 0;
    const rated = o.seller && o.seller.ratingCount >= 3;
    parts.set(o.id, {
      price: o.price > 0 ? Math.min(1, minPrice / o.price) * WEIGHTS.price : 0,
      condition: Math.min(WEIGHTS.condition, (TYPE_POINTS[type ?? ""] ?? 6) + (grade ? GRADE_BONUS[grade.toLowerCase()] ?? 0 : 0)),
      warranty: (Math.min(months, 24) / 24) * WEIGHTS.warranty,
      seller: !o.seller ? 8 : rated ? (o.seller.ratingAvg / 5) * WEIGHTS.seller : 5,
      dispatch: Math.max(0, WEIGHTS.dispatch - (o.handlingDays ?? 1) * 2),
      verification: o.verification === "PLATFORM_VERIFIED" ? WEIGHTS.verification : o.verification === "SELLER_DECLARED" ? 2 : 0,
    });
  }
  const total = (p: Record<Factor, number>) => Object.values(p).reduce((a, b) => a + b, 0);
  const best = (f: Factor) => Math.max(...pool.map((o) => parts.get(o.id)![f]));
  const ranked = offers.map((o) => {
    const p = parts.get(o.id)!;
    const reasons: Reason[] = [];
    const isBest = (f: Factor) => pool.length > 1 && p[f] > 0 && p[f] >= best(f) - 0.01;
    if (isBest("price") && pool.some((x) => x.price > o.price)) reasons.push("lowest_price");
    if (isBest("condition") && pool.some((x) => parts.get(x.id)!.condition < p.condition)) reasons.push("best_condition");
    if (isBest("warranty") && pool.some((x) => parts.get(x.id)!.warranty < p.warranty)) reasons.push("longest_warranty");
    if (o.seller && o.seller.ratingCount >= 3 && o.seller.ratingAvg >= 4.5) reasons.push("top_rated_seller");
    if ((o.handlingDays ?? 1) <= 1 && pool.some((x) => (x.handlingDays ?? 1) > (o.handlingDays ?? 1))) reasons.push("fast_dispatch");
    if (o.verification === "PLATFORM_VERIFIED") reasons.push("verified");
    if (!o.seller) reasons.push("direct_store");
    return { offer: o, score: Math.round(total(p) * 10) / 10, parts: p, reasons: reasons.slice(0, 3), recommended: false };
  });
  // in-stock first, then score, then lower price; stable for ties
  ranked.sort((a, b) => Number(offerAvailable(b.offer)) - Number(offerAvailable(a.offer)) || b.score - a.score || a.offer.price - b.offer.price);
  if (ranked.length && offerAvailable(ranked[0].offer)) ranked[0].recommended = true;
  return ranked;
}

// ───────────── reference "new" price ─────────────

type OptV = { option1?: string | null; option2?: string | null; option3?: string | null; price: number; approvalStatus?: string; seller?: OfferSeller | null };
/**
 * "x% vs new" compares a renewed price with the cheapest listed Brand New offer of the SAME other options
 * (e.g. same capacity); falls back to the product's reference price.
 */
export function referenceNewPrice(v: OptV, variants: OptV[], priceNew: number, conditionIndex = 0) {
  const keys = ["option1", "option2", "option3"] as const;
  if (v[keys[conditionIndex]] === "Brand New") return Math.max(priceNew, v.price);
  const news = variants.filter((x) => offerListed(x) && x[keys[conditionIndex]] === "Brand New" && keys.every((k, i) => i === conditionIndex || x[k] === v[k]));
  if (news.length) return Math.max(Math.min(...news.map((x) => x.price)), v.price);
  return priceNew;
}

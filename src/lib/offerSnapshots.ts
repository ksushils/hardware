import type { Variant } from "@prisma/client";

/**
 * Terms the buyer agreed to at checkout, copied onto OrderItem so later seller edits can never reduce the buyer's rights.
 * Defaults apply when an offer doesn't set its own warranty/returns.
 */
export type OfferTerms = {
  conditionType: string | null; cosmeticGrade: string | null; functionalStatus: string | null; batteryHealth: number | null; batteryCycles: number | null;
  repairDisclosure: string | null; accessories: string | null; verification: string; testedAt: string | null; testedBy: string | null; option: string;
};

export function offerSnapshots(
  v: Pick<Variant, "title" | "conditionType" | "cosmeticGrade" | "functionalStatus" | "batteryHealth" | "batteryCycles" | "repairDisclosure" | "accessories" | "verification" | "testedAt" | "testedBy" | "warrantyProvider" | "warrantyMonths" | "warrantyTerms" | "returnDays" | "returnTerms">,
  seller: { shopName: string } | null | undefined,
  defaults: { warrantyMonths: number; returnDays: number; storeName: string },
) {
  const condition: OfferTerms = {
    conditionType: v.conditionType, cosmeticGrade: v.cosmeticGrade, functionalStatus: v.functionalStatus, batteryHealth: v.batteryHealth, batteryCycles: v.batteryCycles,
    repairDisclosure: v.repairDisclosure, accessories: v.accessories, verification: v.verification, testedAt: v.testedAt?.toISOString() ?? null, testedBy: v.testedBy, option: v.title,
  };
  const warranty = {
    provider: v.warrantyProvider ?? (seller ? "SELLER" : "KARAT"),
    months: v.warrantyMonths ?? defaults.warrantyMonths,
    terms: v.warrantyTerms ?? null,
  };
  const returns = { days: v.returnDays ?? defaults.returnDays, terms: v.returnTerms ?? null };
  return {
    sellerName: seller?.shopName ?? defaults.storeName,
    conditionSnapshot: JSON.stringify(condition),
    warrantySnapshot: JSON.stringify(warranty),
    returnSnapshot: JSON.stringify(returns),
  };
}

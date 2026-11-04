// Plain (server-safe) defaults for the offer terms form. Kept out of the "use client" component so server pages can call blankTerms().
export type OfferTermsInitial = {
  conditionType: string; cosmeticGrade: string; functionalStatus: string; batteryHealth: string; batteryCycles: string; repairDisclosure: string; accessories: string;
  testedAt: string; testedBy: string; testNotes: string; warrantyProvider: string; warrantyMonths: string; warrantyTerms: string; returnDays: string; returnTerms: string;
  handlingDays: string; photos: string[]; declared: boolean; verification?: string;
};
export const blankTerms = (): OfferTermsInitial => ({
  conditionType: "REFURBISHED", cosmeticGrade: "", functionalStatus: "", batteryHealth: "", batteryCycles: "", repairDisclosure: "", accessories: "", testedAt: "", testedBy: "", testNotes: "",
  warrantyProvider: "SELLER", warrantyMonths: "12", warrantyTerms: "", returnDays: "", returnTerms: "", handlingDays: "1", photos: [], declared: false,
});

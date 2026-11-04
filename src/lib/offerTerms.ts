import { CONDITION_TYPES } from "./offers";

/** Offer condition/evidence/terms fields parsed from a form (seller portal) — shared by the offer form and the new-product form. */
export type ParsedTerms = {
  conditionType: string; cosmeticGrade: string | null; functionalStatus: string | null; batteryHealth: number | null; batteryCycles: number | null;
  repairDisclosure: string | null; accessories: string | null; testedAt: Date | null; testedBy: string | null; testNotes: string | null;
  warrantyProvider: string | null; warrantyMonths: number | null; warrantyTerms: string | null; returnDays: number | null; returnTerms: string | null; handlingDays: number;
  declared: boolean; hasEvidence: boolean;
};

const str = (fd: FormData, k: string, max: number) => {
  const v = String(fd.get(k) ?? "").trim().slice(0, max);
  return v || null;
};
const int = (fd: FormData, k: string): number | null | "bad" => {
  const raw = String(fd.get(k) ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : "bad";
};

/**
 * @param minReturnDays the store's minimum return window: sellers may offer MORE days, never fewer (consumer rights).
 */
export function parseOfferTerms(fd: FormData, minReturnDays: number): { ok: true; terms: ParsedTerms } | { ok: false; error: string } {
  const conditionType = String(fd.get("conditionType") || "");
  if (!(CONDITION_TYPES as readonly string[]).includes(conditionType)) return { ok: false, error: "Choose the commercial condition (new, open box, refurbished, used or parts)." };
  const bat = int(fd, "batteryHealth"), cyc = int(fd, "batteryCycles"), wm = int(fd, "warrantyMonths"), rd = int(fd, "returnDays"), hd = int(fd, "handlingDays");
  if (bat === "bad" || (bat != null && bat > 100)) return { ok: false, error: "Battery health must be a whole number from 0 to 100." };
  if (cyc === "bad") return { ok: false, error: "Battery cycle count must be a whole number." };
  if (wm === "bad" || (wm != null && wm > 60)) return { ok: false, error: "Warranty months must be a whole number up to 60." };
  if (rd === "bad" || (rd != null && rd > 90)) return { ok: false, error: "Return days must be a whole number up to 90." };
  if (hd === "bad" || (hd != null && hd > 14)) return { ok: false, error: "Handling time must be 0–14 business days." };
  if (rd != null && rd < minReturnDays) return { ok: false, error: `Return window can't be shorter than the marketplace minimum of ${minReturnDays} days. Leave it blank to use the standard window.` };
  const wp = String(fd.get("warrantyProvider") || "");
  if (wp && !["SELLER", "MANUFACTURER", "NONE"].includes(wp)) return { ok: false, error: "Choose who provides the warranty (seller, manufacturer or none)." };
  const testedRaw = String(fd.get("testedAt") || "").trim();
  const testedAt = testedRaw ? new Date(testedRaw) : null;
  if (testedAt && (Number.isNaN(+testedAt) || testedAt > new Date())) return { ok: false, error: "Test date is invalid or in the future." };
  const t: ParsedTerms = {
    conditionType, cosmeticGrade: str(fd, "cosmeticGrade", 40), functionalStatus: str(fd, "functionalStatus", 200), batteryHealth: bat, batteryCycles: cyc,
    repairDisclosure: str(fd, "repairDisclosure", 1000), accessories: str(fd, "accessories", 500), testedAt, testedBy: str(fd, "testedBy", 120), testNotes: str(fd, "testNotes", 1000),
    warrantyProvider: wp || null, warrantyMonths: wp === "NONE" ? 0 : wm, warrantyTerms: str(fd, "warrantyTerms", 1500), returnDays: rd, returnTerms: str(fd, "returnTerms", 1500),
    handlingDays: hd ?? 1, declared: fd.get("declare") === "on", hasEvidence: false,
  };
  t.hasEvidence = !!(t.cosmeticGrade || t.functionalStatus || t.batteryHealth != null || t.batteryCycles != null || t.repairDisclosure || t.accessories || t.testedAt || t.testedBy || t.testNotes);
  if (t.hasEvidence && !t.declared) return { ok: false, error: "Tick the declaration to confirm the condition details you entered are accurate." };
  if (conditionType !== "NEW" && !t.cosmeticGrade && !t.functionalStatus) return { ok: false, error: "For open-box, refurbished, used or parts offers, state the cosmetic grade or functional status." };
  return { ok: true, terms: t };
}

type Old = Partial<Record<keyof ParsedTerms | "photos", unknown>>;
/** Changes to what the buyer is promised (condition, evidence, terms, photos) must be re-reviewed; price/stock never are. */
export function termsChanged(old: Old, t: ParsedTerms, photos: string[]) {
  const norm = (x: unknown) => (x instanceof Date ? x.toISOString().slice(0, 10) : x ?? null);
  const keys: (keyof ParsedTerms)[] = ["conditionType", "cosmeticGrade", "functionalStatus", "batteryHealth", "batteryCycles", "repairDisclosure", "accessories", "testedAt", "testedBy", "testNotes", "warrantyProvider", "warrantyMonths", "warrantyTerms", "returnDays", "returnTerms", "handlingDays"];
  if (keys.some((k) => norm(old[k]) !== norm(t[k]))) return true;
  let oldPhotos: string[] = [];
  try { oldPhotos = typeof old.photos === "string" ? JSON.parse(old.photos) : (old.photos as string[]) ?? []; } catch {}
  return JSON.stringify(oldPhotos) !== JSON.stringify(photos);
}

/** Data fields to write on a Variant from parsed terms (verification is decided by the caller). */
export function termsData(t: ParsedTerms, photos: string[]) {
  return {
    conditionType: t.conditionType, cosmeticGrade: t.cosmeticGrade, functionalStatus: t.functionalStatus, batteryHealth: t.batteryHealth, batteryCycles: t.batteryCycles,
    repairDisclosure: t.repairDisclosure, accessories: t.accessories, testedAt: t.testedAt, testedBy: t.testedBy, testNotes: t.testNotes, photos: JSON.stringify(photos),
    warrantyProvider: t.warrantyProvider, warrantyMonths: t.warrantyMonths, warrantyTerms: t.warrantyTerms, returnDays: t.returnDays, returnTerms: t.returnTerms, handlingDays: t.handlingDays,
  };
}

/** Allowed unit-photo URLs: our own uploads or https. */
export const cleanPhotoUrls = (urls: unknown) =>
  (Array.isArray(urls) ? urls : []).filter((u): u is string => typeof u === "string" && (u.startsWith("/uploads/") || u.startsWith("https://"))).slice(0, 8);

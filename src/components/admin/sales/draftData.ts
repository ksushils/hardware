import "server-only";
import { db } from "@/lib/db";
import { getSettings, pricingConfig } from "@/lib/settings";
import type { DraftInitial } from "./DraftForm";

export async function draftContext() {
  const [rates, s] = await Promise.all([db.shippingRate.findMany({ where: { active: true }, orderBy: { position: "asc" } }), getSettings()]);
  return { rates: rates.map((r) => ({ id: r.id, name: r.name, price: r.price, freeAbove: r.freeAbove })), cfg: pricingConfig(s) };
}

export const emptyDraft: DraftInitial = {
  email: "", fullName: "", phone: "", emirate: "Dubai", area: "", street: "", building: "", lines: [],
  discountType: "none", discountValue: 0, discountReason: "", shippingRateId: "", customShipping: 0, customShippingName: "", note: "", tags: "",
};

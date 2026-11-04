// Shared by server and client. All prices are VAT-inclusive.
export type PricingConfig = { taxRate: number; codFee: number; carePlusPercent: number; carePlusMin: number };
export const DEFAULT_PRICING: PricingConfig = { taxRate: 5, codFee: 10, carePlusPercent: 6, carePlusMin: 29 };

export function warrantyPrice(price: number, cfg: PricingConfig = DEFAULT_PRICING) {
  return Math.max(cfg.carePlusMin, Math.round(price * (cfg.carePlusPercent / 100)));
}

export type PricedLine = { price: number; quantity: number; warranty: boolean };
export type RateLike = { price: number; freeAbove: number | null } | null;

export function lineTotal(l: PricedLine, cfg: PricingConfig = DEFAULT_PRICING) {
  return (l.price + (l.warranty ? warrantyPrice(l.price, cfg) : 0)) * l.quantity;
}

/**
 * discount: amount already evaluated server-side (see lib/discounts.ts)
 * freeShipping: from a FREE_SHIPPING discount
 * giftCardBalance: available gift card balance, applied last
 * shipmentFees: per-shipment delivery fees (see lib/shipmentMath.ts). When given they replace `rate`; the sum is the order's shipping.
 */
export function computeTotals(
  lines: PricedLine[],
  opts: { rate?: RateLike; paymentMethod?: string; discount?: number; freeShipping?: boolean; giftCardBalance?: number; cfg?: PricingConfig; shipmentFees?: number[] } = {},
) {
  const cfg = opts.cfg ?? DEFAULT_PRICING;
  const subtotal = round(lines.reduce((s, l) => s + lineTotal(l, cfg), 0));
  const discount = round(Math.min(opts.discount ?? 0, subtotal));
  const afterDiscount = subtotal - discount;
  let shipping = 0;
  if (opts.shipmentFees) {
    shipping = opts.freeShipping ? 0 : round(opts.shipmentFees.reduce((a, b) => a + b, 0));
  } else if (opts.rate && !opts.freeShipping) {
    shipping = opts.rate.freeAbove != null && afterDiscount >= opts.rate.freeAbove ? 0 : opts.rate.price;
  }
  const codFee = opts.paymentMethod === "COD" ? cfg.codFee : 0;
  const gross = round(afterDiscount + shipping + codFee);
  const vat = round(gross - gross / (1 + cfg.taxRate / 100));
  const giftCard = round(Math.min(opts.giftCardBalance ?? 0, gross));
  const total = round(gross - giftCard);
  return { subtotal, discount, shipping, codFee, gross, vat, giftCard, total };
}

export function installment(total: number, parts = 4) {
  return Math.ceil((total / parts) * 100) / 100;
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

// All prices are VAT-inclusive (UAE standard 5%).
export const VAT_RATE = 0.05;
export const EXPRESS_FEE = 25;
export const STANDARD_FEE = 15;
export const FREE_SHIPPING_MIN = 200;
export const COD_FEE = 10;

export function warrantyPrice(price: number) {
  return Math.max(29, Math.round(price * 0.06));
}

export type PricedLine = { price: number; quantity: number; warranty: boolean };

export type Coupon = { code: string; type: string; value: number; minSpend: number };

export function computeTotals(
  lines: PricedLine[],
  opts: { shippingMethod?: string; paymentMethod?: string; coupon?: Coupon | null } = {},
) {
  const subtotal = lines.reduce(
    (s, l) => s + (l.price + (l.warranty ? warrantyPrice(l.price) : 0)) * l.quantity,
    0,
  );
  let discount = 0;
  if (opts.coupon && subtotal >= opts.coupon.minSpend) {
    discount =
      opts.coupon.type === "PERCENT" ? Math.round(subtotal * (opts.coupon.value / 100)) : opts.coupon.value;
    discount = Math.min(discount, subtotal);
  }
  let shipping = subtotal - discount >= FREE_SHIPPING_MIN || subtotal === 0 ? 0 : STANDARD_FEE;
  if (opts.shippingMethod === "EXPRESS") shipping = EXPRESS_FEE;
  const codFee = opts.paymentMethod === "COD" ? COD_FEE : 0;
  shipping += codFee;
  const total = Math.max(0, subtotal - discount + shipping);
  const vat = Math.round((total - total / (1 + VAT_RATE)) * 100) / 100;
  return { subtotal, discount, shipping, codFee, vat, total };
}

export function installment(total: number, parts = 4) {
  return Math.ceil((total / parts) * 100) / 100;
}

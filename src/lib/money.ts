// Currency-aware money helpers. Safe for server AND client use (no server-only imports).
// The app still stores AED amounts as Float with 2-dp rounding; the ledger converts to integer minor units at the boundary.

/** Minor-unit exponent per currency (AED has fils = 100 per dirham; KWD/BHD/OMR have 1000 minor units). */
export const CURRENCIES: Record<string, { exponent: number; symbol: string }> = {
  AED: { exponent: 2, symbol: "AED" },
  SAR: { exponent: 2, symbol: "SAR" },
  QAR: { exponent: 2, symbol: "QAR" },
  KWD: { exponent: 3, symbol: "KWD" },
  BHD: { exponent: 3, symbol: "BHD" },
  OMR: { exponent: 3, symbol: "OMR" },
};

export function exponentOf(currency = "AED") {
  const c = CURRENCIES[currency.toUpperCase()];
  if (!c) throw new Error(`Unsupported currency ${currency}`);
  return c.exponent;
}

/** Round half away from zero to an integer (Math.round rounds -2.5 to -2; money must treat +/- symmetrically). */
export function roundHalfAwayFromZero(n: number) {
  if (!Number.isFinite(n)) throw new Error("Not a finite number");
  const sign = n < 0 ? -1 : 1;
  // nudge by a tiny epsilon relative to magnitude so 1.005*100 = 100.49999999999999 rounds like a human expects
  const abs = Math.abs(n);
  return sign * Math.floor(abs + 0.5 + Number.EPSILON * Math.max(1, abs));
}

/** 12.345 AED → 1235 fils (2 dp) / 12.345 KWD → 12345 (3 dp). */
export function toMinor(amount: number, currency = "AED") {
  const f = 10 ** exponentOf(currency);
  // go through a fixed string first to strip binary float noise (e.g. 0.1 + 0.2)
  return roundHalfAwayFromZero(Number((amount * f).toPrecision(15)));
}

export function fromMinor(minor: number, currency = "AED") {
  return minor / 10 ** exponentOf(currency);
}

export function formatMoney(minor: number, currency = "AED", locale = "en-AE") {
  const e = exponentOf(currency);
  const n = fromMinor(minor, currency);
  return `${CURRENCIES[currency.toUpperCase()].symbol} ${n.toLocaleString(locale, { minimumFractionDigits: e, maximumFractionDigits: e })}`;
}

/** Plain decimal string with the currency's exact precision, e.g. 12345 → "12.345" (for CSV and statements). */
export function minorToDecimal(minor: number, currency = "AED") {
  return fromMinor(minor, currency).toFixed(exponentOf(currency));
}

/**
 * Splits `total` (integer minor units, may be negative) across `weights` with the largest-remainder method,
 * so the parts ALWAYS sum exactly to `total`. Zero weights get zero. Throws if all weights are zero and total ≠ 0.
 */
export function allocate(total: number, weights: number[]): number[] {
  if (!Number.isInteger(total)) throw new Error("allocate: total must be an integer");
  const w = weights.map((x) => Math.abs(x));
  const sum = w.reduce((a, b) => a + b, 0);
  if (sum === 0) {
    if (total !== 0) throw new Error("allocate: cannot allocate a non-zero total over zero weights");
    return weights.map(() => 0);
  }
  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(total);
  const raw = w.map((x) => (abs * x) / sum);
  const floors = raw.map(Math.floor);
  let remainder = abs - floors.reduce((a, b) => a + b, 0);
  // hand out the leftover units to the largest fractional parts (ties: earlier index)
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  const out = [...floors];
  for (const { i } of order) {
    if (remainder <= 0) break;
    if (w[i] === 0) continue;
    out[i] += 1;
    remainder -= 1;
  }
  return out.map((x) => sign * x);
}

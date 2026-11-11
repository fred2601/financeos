/**
 * Display formatting (Danish conventions). The only place where numbers are rounded.
 * `null` is always shown as "n/a".
 */
import type { Maybe } from "@/lib/finance/safe-math";

export const NA = "n/a";
const LOCALE = "da-DK";
const MINUS = "−"; // typographic minus, aligns better in tables

const fmt = (value: number, digits: number) =>
  new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

const withSign = (formatted: string, value: number, signed: boolean) => {
  const body = formatted.replace(/^[-−]/, "");
  if (value < 0) return MINUS + body;
  if (signed && value > 0) return "+" + body;
  return body;
};

export type DkkScale = "auto" | "kr" | "t" | "mio";

/**
 * DKK amounts: "1.234.567 kr.", "1.235 t.kr.", "12,3 mio. kr."
 * "auto" picks mio. for |value| ≥ 1m, t.kr. for ≥ 10k, otherwise kr.
 */
export function formatDkk(
  value: Maybe,
  options: { scale?: DkkScale; digits?: number; signed?: boolean } = {},
): string {
  if (value === null || !Number.isFinite(value)) return NA;
  const { signed = false } = options;
  const abs = Math.abs(value);
  const scale =
    options.scale && options.scale !== "auto"
      ? options.scale
      : abs >= 1_000_000
        ? "mio"
        : abs >= 10_000
          ? "t"
          : "kr";
  const [divisor, suffix, defaultDigits] =
    scale === "mio" ? [1_000_000, "mio. kr.", 1] : scale === "t" ? [1_000, "t.kr.", 0] : [1, "kr.", 0];
  const scaled = value / divisor;
  const digits = options.digits ?? defaultDigits;
  return `${withSign(fmt(scaled, digits), roundTo(scaled, digits), signed)} ${suffix}`;
}

/** Fraction → "12,3 %". */
export function formatPercent(
  fraction: Maybe,
  options: { digits?: number; signed?: boolean } = {},
): string {
  if (fraction === null || !Number.isFinite(fraction)) return NA;
  const { digits = 1, signed = false } = options;
  const pct = fraction * 100;
  return `${withSign(fmt(pct, digits), roundTo(pct, digits), signed)} %`;
}

/** Difference between two ratios (as a fraction) → "+1,2 pp" (percentage points). */
export function formatPp(fractionDiff: Maybe, digits = 1): string {
  if (fractionDiff === null || !Number.isFinite(fractionDiff)) return NA;
  const pp = fractionDiff * 100;
  return `${withSign(fmt(pp, digits), roundTo(pp, digits), true)} pp`;
}

/** Plain number with Danish separators: "12.345". */
export function formatNumber(value: Maybe, digits = 0): string {
  if (value === null || !Number.isFinite(value)) return NA;
  return withSign(fmt(value, digits), roundTo(value, digits), false);
}

/** Avoids "−0,0" by treating values that round to zero as zero. */
function roundTo(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/**
 * Materiality: how big a variance must be before we call it favorable or unfavorable.
 * Smaller variances are reported as "on budget" (neutral), so noise does not get coloured
 * red/green. A variance is material only if it passes BOTH the % and the DKK threshold
 * (a 40 % variance on a 10.000 kr. line is not something a CFO acts on).
 */
export interface Materiality {
  /** Minimum |variance %| for amounts, as a fraction (0.01 = 1 %). */
  percent: number;
  /** Minimum |variance| in DKK for amounts. */
  absoluteDkk: number;
  /** Minimum |change| for ratios such as margins, as a fraction (0.001 = 0,1 pp). */
  ratio: number;
}

export const DEFAULT_MATERIALITY: Materiality = {
  percent: 0.01,
  absoluteDkk: 50_000,
  ratio: 0.001,
};

export function isMaterialAmount(
  absolute: number | null,
  percent: number | null,
  m: Materiality = DEFAULT_MATERIALITY,
): boolean {
  if (absolute === null) return false;
  if (Math.abs(absolute) < m.absoluteDkk) return false;
  // No % available (reference is 0): judge on the DKK amount alone.
  return percent === null || Math.abs(percent) >= m.percent;
}

export function isMaterialRatio(absolute: number | null, m: Materiality = DEFAULT_MATERIALITY): boolean {
  return absolute !== null && Math.abs(absolute) >= m.ratio;
}

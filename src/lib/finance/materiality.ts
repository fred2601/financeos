/**
 * Materiality: how big a variance must be before we call it favorable or unfavorable.
 * Smaller variances are reported as "within threshold" (neutral), so noise does not get
 * coloured red/green.
 *
 * Amounts are material when
 *   (|variance| ≥ 50.000 kr. AND |variance %| ≥ 1 %)   — filters noise on small lines
 *   OR |variance| ≥ 1.000.000 kr.                       — large amounts always matter
 * The second rule exists because on large totals (e.g. full-year revenue ≈ 420 mio. kr.)
 * a 2,5 mio. kr. miss is only 0,6 % — below the % threshold, but not something a CFO would
 * call "on budget".
 */
export interface Materiality {
  /** Minimum |variance %| for amounts, as a fraction (0.01 = 1 %). */
  percent: number;
  /** Minimum |variance| in DKK for amounts. */
  absoluteDkk: number;
  /** Variances at or above this DKK amount are always material, whatever the %. */
  alwaysMaterialDkk: number;
  /** Minimum |change| for ratios such as margins, as a fraction (0.001 = 0,1 pp). */
  ratio: number;
}

export const DEFAULT_MATERIALITY: Materiality = {
  percent: 0.01,
  absoluteDkk: 50_000,
  alwaysMaterialDkk: 1_000_000,
  ratio: 0.001,
};

export function isMaterialAmount(
  absolute: number | null,
  percent: number | null,
  m: Materiality = DEFAULT_MATERIALITY,
): boolean {
  if (absolute === null) return false;
  const abs = Math.abs(absolute);
  if (abs >= m.alwaysMaterialDkk) return true;
  if (abs < m.absoluteDkk) return false;
  // No % available (reference is 0): judge on the DKK amount alone.
  return percent === null || Math.abs(percent) >= m.percent;
}

export function isMaterialRatio(absolute: number | null, m: Materiality = DEFAULT_MATERIALITY): boolean {
  return absolute !== null && Math.abs(absolute) >= m.ratio;
}

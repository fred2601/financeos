import { ACCOUNTS } from "@/lib/data/chart-of-accounts";
import { CATEGORY_IDS, type CategoryId } from "@/lib/data/schema";
import { safeDivide, type Maybe } from "./safe-math";

/**
 * Driver-based forecast.
 *
 * The forecast year is built month by month from the base year's actuals (same month last
 * year), so seasonality is kept automatically:
 *
 *   units_F    = units_base    × (1 + unit growth)
 *   ASP_F      = ASP_base      × (1 + price change)
 *   revenue_F  = units_F × ASP_F
 *   GM%_F      = GM%_base + margin change (pp)
 *   COGS_F     = revenue_F × (1 − GM%_F)
 *   opex_F     = opex_base × (1 + cost growth)        per opex account
 *   EBITDA_F   = (revenue_F − COGS_F) − opex_F
 *
 * Because the drivers apply uniformly, the same formulas also hold for full-year totals,
 * which keeps the "show formula" panel exact.
 */

export const OPEX_ACCOUNT_IDS = ACCOUNTS.filter((a) => a.type === "opex").map((a) => a.id);
export type OpexAccountId = (typeof OPEX_ACCOUNT_IDS)[number];

export interface CategoryAssumption {
  /** Unit volume growth vs base year, fraction (0.03 = +3 %). */
  unitGrowth: number;
  /** Average selling price change vs base year, fraction. */
  priceChange: number;
  /** Gross margin change vs base year, fraction of revenue (0.005 = +0,5 pp). */
  marginChange: number;
}

export interface ForecastAssumptions {
  categories: Record<CategoryId, CategoryAssumption>;
  /** Cost growth vs base year per opex account, fraction. */
  opex: Record<OpexAccountId, number>;
}

/** Illustrative starting assumptions, not predictions. Users are expected to change them. */
export const DEFAULT_ASSUMPTIONS: ForecastAssumptions = {
  categories: {
    "home-living": { unitGrowth: 0.02, priceChange: 0.02, marginChange: 0 },
    fashion: { unitGrowth: 0.02, priceChange: 0.02, marginChange: 0 },
    "outdoor-sport": { unitGrowth: 0.03, priceChange: 0.02, marginChange: 0 },
  },
  opex: {
    OPEX_PERSONNEL: 0.035,
    OPEX_RENT: 0.02,
    OPEX_MARKETING: 0.03,
    OPEX_LOGISTICS: 0.03,
    OPEX_IT: 0.05,
    OPEX_OTHER: 0.02,
  },
};

/** Allowed input ranges (fractions). Values outside are clamped. */
export const ASSUMPTION_BOUNDS = {
  unitGrowth: { min: -0.5, max: 1 },
  priceChange: { min: -0.5, max: 1 },
  marginChange: { min: -0.2, max: 0.2 },
  opex: { min: -0.5, max: 1 },
} as const;

export function clamp(value: number, bounds: { min: number; max: number }): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(bounds.max, Math.max(bounds.min, value));
}

/** Base-year actuals for one month. */
export interface ForecastBaseMonth {
  month: number; // 1–12
  categories: Record<CategoryId, { units: Maybe; revenue: Maybe; cogs: Maybe }>;
  opex: Record<OpexAccountId, Maybe>;
}

export interface CategoryForecast {
  units: Maybe;
  revenue: Maybe;
  cogs: Maybe;
}

export interface MonthForecast {
  month: number;
  categories: Record<CategoryId, CategoryForecast>;
  opex: Record<OpexAccountId, Maybe>;
}

/** Forecast one category for one month. Null base data → null forecast (never a fake 0). */
export function forecastCategoryMonth(
  base: { units: Maybe; revenue: Maybe; cogs: Maybe },
  a: CategoryAssumption,
): CategoryForecast {
  const { units, revenue, cogs } = base;
  if (units === null || revenue === null || cogs === null) return { units: null, revenue: null, cogs: null };
  const unitsF = units * (1 + a.unitGrowth);

  // Zero base revenue: no price and no margin to apply. Revenue stays 0 and any costs
  // are kept, scaled with volume (cost per unit unchanged), rather than dropped to 0.
  if (revenue === 0) return { units: unitsF, revenue: 0, cogs: cogs * (1 + a.unitGrowth) };

  // Revenue without units means there is no average selling price, so
  // "revenue = units × ASP" cannot be applied. Report n/a instead of inventing a number.
  const aspBase = safeDivide(revenue, units);
  if (aspBase === null) return { units: null, revenue: null, cogs: null };

  // Revenue = units × ASP, with ASP_F = ASP_base × (1 + price change).
  const revenueF = unitsF * aspBase * (1 + a.priceChange);
  // Margin change is in percentage points: GM%_F = GM%_base + change (not × (1 + change)).
  const baseMargin = safeDivide(revenue - cogs, revenue);
  if (baseMargin === null) return { units: null, revenue: null, cogs: null };
  const marginF = baseMargin + a.marginChange;
  return { units: unitsF, revenue: revenueF, cogs: revenueF * (1 - marginF) };
}

export function forecastMonth(base: ForecastBaseMonth, a: ForecastAssumptions): MonthForecast {
  const categories = {} as Record<CategoryId, CategoryForecast>;
  for (const c of CATEGORY_IDS) categories[c] = forecastCategoryMonth(base.categories[c], a.categories[c]);
  const opex = {} as Record<OpexAccountId, Maybe>;
  for (const id of OPEX_ACCOUNT_IDS) {
    const v = base.opex[id];
    opex[id] = v === null ? null : v * (1 + a.opex[id]);
  }
  return { month: base.month, categories, opex };
}

export function forecastYear(base: readonly ForecastBaseMonth[], a: ForecastAssumptions): MonthForecast[] {
  return base.map((m) => forecastMonth(m, a));
}

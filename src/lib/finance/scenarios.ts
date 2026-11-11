import { CATEGORY_IDS } from "@/lib/data/schema";
import { clamp, OPEX_ACCOUNT_IDS, type ForecastAssumptions } from "./forecast";
import type { Maybe } from "./safe-math";

/**
 * Scenario analysis: three company-level levers applied to the base year (FY actuals).
 *
 *   sales growth  → revenue growth (applied as volume, at unchanged prices and mix)
 *   margin change → gross margin + change, in percentage points, for every category
 *   opex change   → every operating expense account × (1 + change)
 *
 * Scenarios reuse the tested forecast engine via `leversToAssumptions`, so monthly
 * seasonality and all reconciliations carry over. For full-year totals the result has a
 * closed form, used for the formula display and sensitivities:
 *
 *   EBITDA = (1 + s) × (GP₀ + m × Revenue₀) − (1 + o) × Opex₀
 */

export const SCENARIO_IDS = ["worst", "base", "best"] as const;
export type ScenarioId = (typeof SCENARIO_IDS)[number];

export interface ScenarioLevers {
  /** Revenue growth vs base year, fraction. */
  salesGrowth: number;
  /** Gross margin change vs base year, fraction of revenue (0.01 = +1 pp). */
  marginChange: number;
  /** Operating expense change vs base year, fraction. */
  opexChange: number;
}

export type ScenarioSet = Record<ScenarioId, ScenarioLevers>;

export const SCENARIO_LABELS: Record<ScenarioId, string> = {
  worst: "Worst case",
  base: "Base case",
  best: "Best case",
};

/** Illustrative presets, not predictions. */
export const SCENARIO_PRESETS: ScenarioSet = {
  worst: { salesGrowth: -0.03, marginChange: -0.015, opexChange: 0.045 },
  base: { salesGrowth: 0.04, marginChange: 0, opexChange: 0.03 },
  best: { salesGrowth: 0.08, marginChange: 0.01, opexChange: 0.02 },
};

export const LEVER_BOUNDS = {
  salesGrowth: { min: -0.5, max: 1 },
  marginChange: { min: -0.2, max: 0.2 },
  opexChange: { min: -0.5, max: 1 },
} as const;

export function clampLevers(l: ScenarioLevers): ScenarioLevers {
  return {
    salesGrowth: clamp(l.salesGrowth, LEVER_BOUNDS.salesGrowth),
    marginChange: clamp(l.marginChange, LEVER_BOUNDS.marginChange),
    opexChange: clamp(l.opexChange, LEVER_BOUNDS.opexChange),
  };
}

/** Translates company-level levers into the forecast engine's driver assumptions. */
export function leversToAssumptions(l: ScenarioLevers): ForecastAssumptions {
  const categories = {} as ForecastAssumptions["categories"];
  for (const c of CATEGORY_IDS) {
    categories[c] = { unitGrowth: l.salesGrowth, priceChange: 0, marginChange: l.marginChange };
  }
  const opex = {} as ForecastAssumptions["opex"];
  for (const id of OPEX_ACCOUNT_IDS) opex[id] = l.opexChange;
  return { categories, opex };
}

export interface BaseTotals {
  revenue: Maybe;
  grossProfit: Maybe;
  opex: Maybe;
}

/** Closed-form full-year EBITDA for a scenario. */
export function scenarioEbitda(base: BaseTotals, l: ScenarioLevers): Maybe {
  const { revenue, grossProfit, opex } = base;
  if (revenue === null || grossProfit === null || opex === null) return null;
  return (1 + l.salesGrowth) * (grossProfit + l.marginChange * revenue) - (1 + l.opexChange) * opex;
}

export interface Sensitivity {
  /** EBITDA change for +1 % sales growth. */
  sales: Maybe;
  /** EBITDA change for +1 pp gross margin. */
  margin: Maybe;
  /** EBITDA change for +1 % operating expenses. */
  opex: Maybe;
}

/** How much EBITDA moves when each lever moves by one step from the given scenario. */
export function sensitivity(base: BaseTotals, l: ScenarioLevers): Sensitivity {
  const e0 = scenarioEbitda(base, l);
  const delta = (patch: Partial<ScenarioLevers>) => {
    const e1 = scenarioEbitda(base, { ...l, ...patch });
    return e0 === null || e1 === null ? null : e1 - e0;
  };
  return {
    sales: delta({ salesGrowth: l.salesGrowth + 0.01 }),
    margin: delta({ marginChange: l.marginChange + 0.01 }),
    opex: delta({ opexChange: l.opexChange + 0.01 }),
  };
}

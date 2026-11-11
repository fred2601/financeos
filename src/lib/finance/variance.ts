import type { Direction } from "@/lib/data/chart-of-accounts";
import { safeDivide, safeSubtract, type Maybe } from "./safe-math";
import type { PnlMetrics } from "./metrics";

export type Favorability = "favorable" | "unfavorable" | "neutral";

/** Absolute variance = actual − budget. */
export function absoluteVariance(actual: Maybe, budget: Maybe): Maybe {
  return safeSubtract(actual, budget);
}

/**
 * Percentage variance = (actual − budget) / |budget|.
 * Dividing by the absolute budget keeps "+" meaning "above budget" even when the
 * budget is negative (e.g. a planned loss). Null when the budget is 0 or missing.
 */
export function percentVariance(actual: Maybe, budget: Maybe): Maybe {
  return safeDivide(absoluteVariance(actual, budget), budget === null ? null : Math.abs(budget));
}

/** Favorable/unfavorable depends on whether higher is better for this line — not on the sign alone. */
export function favorability(variance: Maybe, direction: Direction): Favorability {
  if (variance === null || variance === 0) return "neutral";
  const higher = variance > 0;
  return higher === (direction === "higher-is-better") ? "favorable" : "unfavorable";
}

export interface Comparison {
  actual: Maybe;
  reference: Maybe;
  /** actual − reference. For ratio metrics this is a difference in percentage points (as a fraction). */
  absolute: Maybe;
  /** (actual − reference) / |reference|. Null for ratio metrics, where only the pp change is meaningful. */
  percent: Maybe;
  status: Favorability;
}

export type MetricKind = "amount" | "ratio";

export function compare(
  actual: Maybe,
  reference: Maybe,
  direction: Direction,
  kind: MetricKind = "amount",
): Comparison {
  const absolute = absoluteVariance(actual, reference);
  return {
    actual,
    reference,
    absolute,
    percent: kind === "ratio" ? null : percentVariance(actual, reference),
    status: favorability(absolute, direction),
  };
}

/** Direction and kind of each P&L metric. */
export const METRIC_PROFILE: Record<keyof PnlMetrics, { direction: Direction; kind: MetricKind }> = {
  revenue: { direction: "higher-is-better", kind: "amount" },
  units: { direction: "higher-is-better", kind: "amount" },
  averageSellingPrice: { direction: "higher-is-better", kind: "amount" },
  cogs: { direction: "lower-is-better", kind: "amount" },
  grossProfit: { direction: "higher-is-better", kind: "amount" },
  grossMargin: { direction: "higher-is-better", kind: "ratio" },
  opex: { direction: "lower-is-better", kind: "amount" },
  ebitda: { direction: "higher-is-better", kind: "amount" },
  ebitdaMargin: { direction: "higher-is-better", kind: "ratio" },
  da: { direction: "lower-is-better", kind: "amount" },
};

export function compareMetric(
  metric: keyof PnlMetrics,
  actual: PnlMetrics,
  reference: PnlMetrics,
): Comparison {
  const { direction, kind } = METRIC_PROFILE[metric];
  return compare(actual[metric], reference[metric], direction, kind);
}

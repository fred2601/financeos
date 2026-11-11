import { safeDivide, type Maybe } from "./safe-math";

/**
 * Price / volume / mix analysis.
 *
 * Splits a revenue (or gross profit) variance into the effects of
 *  - volume: selling more or fewer units in total,
 *  - mix:    selling a different combination of segments (e.g. more of a cheap category),
 *  - price:  selling at a different average selling price (ASP).
 * Each split adds up exactly to the total variance, so nothing is "unexplained".
 *
 * A segment is one product category in one channel. Inputs are matched by `key`.
 */
export interface Segment {
  key: string;
  units: Maybe;
  revenue: Maybe;
  cogs: Maybe;
}

interface SegmentPair {
  key: string;
  unitsA: number;
  unitsB: number;
  revenueA: number;
  revenueB: number;
  cogsA: number;
  cogsB: number;
  aspA: Maybe;
  aspB: number;
}

/**
 * Pairs actual and budget segments. Returns null when any segment is missing data or has
 * zero budget units: then there is no budget price to compare against, and an honest
 * decomposition is not possible.
 */
function pairSegments(actual: readonly Segment[], budget: readonly Segment[]): SegmentPair[] | null {
  if (budget.length === 0) return null;
  const byKey = new Map(actual.map((s) => [s.key, s]));
  if (byKey.size !== budget.length) return null;
  const pairs: SegmentPair[] = [];
  for (const b of budget) {
    const a = byKey.get(b.key);
    if (!a) return null;
    const values = [a.units, a.revenue, a.cogs, b.units, b.revenue, b.cogs];
    if (values.some((v) => v === null || !Number.isFinite(v))) return null;
    const aspB = safeDivide(b.revenue, b.units);
    if (aspB === null) return null;
    pairs.push({
      key: b.key,
      unitsA: a.units as number,
      unitsB: b.units as number,
      revenueA: a.revenue as number,
      revenueB: b.revenue as number,
      cogsA: a.cogs as number,
      cogsB: b.cogs as number,
      aspA: safeDivide(a.revenue, a.units),
      aspB,
    });
  }
  return pairs;
}

/** Per-segment split: volume effect = ΔUnits × budget ASP; price effect = ΔASP × actual units. */
export function segmentPriceVolume(actual: Segment, budget: Segment): { volume: Maybe; price: Maybe } {
  const pairs = pairSegments([actual], [{ ...budget, key: actual.key }]);
  if (!pairs) return { volume: null, price: null };
  const p = pairs[0];
  const volume = (p.unitsA - p.unitsB) * p.aspB;
  return { volume, price: p.revenueA - p.revenueB - volume };
}

export interface RevenuePvm {
  volume: number;
  mix: number;
  price: number;
  /** = volume + mix + price = actual revenue − budget revenue */
  total: number;
}

/**
 * Three-way revenue variance split across segments.
 *  volume = (total actual units − total budget units) × budget average ASP
 *  mix    = Σ actual total units × (actual share − budget share) × segment budget ASP
 *  price  = Σ (actual ASP − budget ASP) × actual units
 */
export function revenuePvm(actual: readonly Segment[], budget: readonly Segment[]): RevenuePvm | null {
  const pairs = pairSegments(actual, budget);
  if (!pairs) return null;
  const unitsA = pairs.reduce((s, p) => s + p.unitsA, 0);
  const unitsB = pairs.reduce((s, p) => s + p.unitsB, 0);
  const revenueA = pairs.reduce((s, p) => s + p.revenueA, 0);
  const revenueB = pairs.reduce((s, p) => s + p.revenueB, 0);
  const avgAspB = safeDivide(revenueB, unitsB);
  if (avgAspB === null) return null;

  const volume = (unitsA - unitsB) * avgAspB;
  // Actual units valued at budget prices, minus actual units valued at the budget average price.
  const atBudgetPrices = pairs.reduce((s, p) => s + p.unitsA * p.aspB, 0);
  const mix = atBudgetPrices - unitsA * avgAspB;
  // Price: the part of actual revenue not explained by budget prices. When actual units
  // are 0 there is no actual price, and this correctly contributes 0.
  const price = revenueA - atBudgetPrices;
  return { volume, mix, price, total: revenueA - revenueB };
}

export interface GrossProfitBridge {
  /** Change in units (incl. mix) valued at budget gross profit per unit. */
  volumeMix: number;
  /** Change in selling price; flows 100 % to gross profit. */
  price: number;
  /** Change in cost per unit (positive = cheaper than budget). */
  unitCost: number;
  /** = actual gross profit − budget gross profit */
  total: number;
}

/**
 * Splits the gross-profit variance into volume/mix, price and unit-cost effects.
 *  volumeMix = Σ (actual units − budget units) × budget GP per unit
 *  price     = Σ (actual ASP − budget ASP) × actual units
 *  unitCost  = −Σ (actual cost per unit − budget cost per unit) × actual units
 */
export function grossProfitBridge(
  actual: readonly Segment[],
  budget: readonly Segment[],
): GrossProfitBridge | null {
  const pairs = pairSegments(actual, budget);
  if (!pairs) return null;
  let volumeMix = 0;
  let price = 0;
  let unitCost = 0;
  for (const p of pairs) {
    const unitCostB = p.cogsB / p.unitsB; // unitsB > 0 guaranteed by pairSegments
    volumeMix += (p.unitsA - p.unitsB) * (p.aspB - unitCostB);
    price += p.revenueA - p.unitsA * p.aspB;
    unitCost += p.unitsA * unitCostB - p.cogsA;
  }
  const total = pairs.reduce((s, p) => s + (p.revenueA - p.cogsA) - (p.revenueB - p.cogsB), 0);
  return { volumeMix, price, unitCost, total };
}

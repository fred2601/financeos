import { describe, expect, it } from "vitest";
import {
  clamp,
  DEFAULT_ASSUMPTIONS,
  forecastCategoryMonth,
  forecastMonth,
  type ForecastAssumptions,
  type ForecastBaseMonth,
} from "./forecast";

const zero: ForecastAssumptions = {
  categories: {
    "home-living": { unitGrowth: 0, priceChange: 0, marginChange: 0 },
    fashion: { unitGrowth: 0, priceChange: 0, marginChange: 0 },
    "outdoor-sport": { unitGrowth: 0, priceChange: 0, marginChange: 0 },
  },
  opex: { OPEX_PERSONNEL: 0, OPEX_RENT: 0, OPEX_MARKETING: 0, OPEX_LOGISTICS: 0, OPEX_IT: 0, OPEX_OTHER: 0 },
};

// 1.000 units × 400 kr. = 400.000 kr. revenue, 50 % gross margin
const base = { units: 1_000, revenue: 400_000, cogs: 200_000 };

describe("forecastCategoryMonth", () => {
  it("returns the base unchanged with zero assumptions", () => {
    expect(forecastCategoryMonth(base, zero.categories.fashion)).toEqual(base);
  });

  it("revenue = forecast units × forecast ASP", () => {
    const f = forecastCategoryMonth(base, { unitGrowth: 0.1, priceChange: 0.05, marginChange: 0 });
    expect(f.units).toBeCloseTo(1_100);
    const asp = 400 * 1.05;
    expect(f.revenue).toBeCloseTo(1_100 * asp); // 462.000
  });

  it("volume growth keeps the margin; margin change is applied in percentage points", () => {
    const vol = forecastCategoryMonth(base, { unitGrowth: 0.1, priceChange: 0, marginChange: 0 });
    expect(vol.cogs).toBeCloseTo(220_000);
    const m = forecastCategoryMonth(base, { unitGrowth: 0, priceChange: 0, marginChange: 0.02 });
    expect(((m.revenue ?? 0) - (m.cogs ?? 0)) / (m.revenue ?? 1)).toBeCloseTo(0.52);
  });

  it("handles negative growth (shrinking volume)", () => {
    const f = forecastCategoryMonth(base, { unitGrowth: -0.2, priceChange: 0, marginChange: 0 });
    expect(f.revenue).toBeCloseTo(320_000);
  });

  it("returns nulls when base data is missing, and zeros for zero base", () => {
    expect(forecastCategoryMonth({ units: null, revenue: 1, cogs: 1 }, zero.categories.fashion)).toEqual({ units: null, revenue: null, cogs: null });
    const z = forecastCategoryMonth({ units: 0, revenue: 0, cogs: 0 }, DEFAULT_ASSUMPTIONS.categories.fashion);
    expect(z.revenue).toBe(0);
    expect(z.cogs).toBe(0);
  });
});

describe("forecastMonth", () => {
  const month: ForecastBaseMonth = {
    month: 3,
    categories: { "home-living": base, fashion: base, "outdoor-sport": { units: null, revenue: null, cogs: null } },
    opex: { OPEX_PERSONNEL: 100_000, OPEX_RENT: 50_000, OPEX_MARKETING: 20_000, OPEX_LOGISTICS: 10_000, OPEX_IT: 5_000, OPEX_OTHER: null },
  };

  it("grows each opex account by its own rate and propagates missing values", () => {
    const f = forecastMonth(month, { ...zero, opex: { ...zero.opex, OPEX_PERSONNEL: 0.035, OPEX_IT: 0.1 } });
    expect(f.opex.OPEX_PERSONNEL).toBeCloseTo(103_500);
    expect(f.opex.OPEX_IT).toBeCloseTo(5_500);
    expect(f.opex.OPEX_RENT).toBe(50_000);
    expect(f.opex.OPEX_OTHER).toBeNull();
    expect(f.categories["outdoor-sport"].revenue).toBeNull();
    expect(f.month).toBe(3);
  });
});

describe("clamp", () => {
  it("keeps values in range and turns non-numbers into 0", () => {
    expect(clamp(5, { min: -0.5, max: 1 })).toBe(1);
    expect(clamp(-2, { min: -0.5, max: 1 })).toBe(-0.5);
    expect(clamp(Number.NaN, { min: -0.5, max: 1 })).toBe(0);
  });
});

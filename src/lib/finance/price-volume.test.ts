import { describe, expect, it } from "vitest";
import { DEFAULT_MATERIALITY, isMaterialAmount, isMaterialRatio } from "./materiality";
import { grossProfitBridge, revenuePvm, segmentPriceVolume, type Segment } from "./price-volume";
import { compare } from "./variance";

// Budget: A = 100 units @ 10 kr. (cost 6), B = 100 units @ 20 kr. (cost 10)
const budget: Segment[] = [
  { key: "A", units: 100, revenue: 1_000, cogs: 600 },
  { key: "B", units: 100, revenue: 2_000, cogs: 1_000 },
];

describe("revenue price/volume/mix", () => {
  it("is all volume when units grow evenly at budget prices", () => {
    const actual: Segment[] = [
      { key: "A", units: 110, revenue: 1_100, cogs: 660 },
      { key: "B", units: 110, revenue: 2_200, cogs: 1_100 },
    ];
    const r = revenuePvm(actual, budget);
    expect(r?.volume).toBeCloseTo(300);
    expect(r?.mix).toBeCloseTo(0);
    expect(r?.price).toBeCloseTo(0);
  });

  it("is all mix when total units are flat but shift to the cheaper segment", () => {
    const actual: Segment[] = [
      { key: "A", units: 150, revenue: 1_500, cogs: 900 },
      { key: "B", units: 50, revenue: 1_000, cogs: 500 },
    ];
    const r = revenuePvm(actual, budget);
    expect(r?.volume).toBeCloseTo(0);
    expect(r?.mix).toBeCloseTo(-500);
    expect(r?.price).toBeCloseTo(0);
  });

  it("is all price when units are on budget but prices differ", () => {
    const actual: Segment[] = [
      { key: "A", units: 100, revenue: 900, cogs: 600 },
      { key: "B", units: 100, revenue: 2_000, cogs: 1_000 },
    ];
    const r = revenuePvm(actual, budget);
    expect(r?.price).toBeCloseTo(-100);
    expect(r?.volume).toBeCloseTo(0);
    expect(r?.mix).toBeCloseTo(0);
  });

  it("always adds up to the total variance", () => {
    const actual: Segment[] = [
      { key: "A", units: 87, revenue: 1_131, cogs: 522 },
      { key: "B", units: 123, revenue: 2_337, cogs: 1_291 },
    ];
    const r = revenuePvm(actual, budget);
    expect(r).not.toBeNull();
    if (r) expect(r.volume + r.mix + r.price).toBeCloseTo(r.total);
    expect(r?.total).toBe(3_468 - 3_000);
  });

  it("returns null when a budget segment has zero units or data is missing", () => {
    expect(revenuePvm(budget, [{ key: "A", units: 0, revenue: 0, cogs: 0 }, budget[1]])).toBeNull();
    expect(revenuePvm([{ ...budget[0], units: null }, budget[1]], budget)).toBeNull();
    expect(revenuePvm([budget[0]], budget)).toBeNull(); // segment B missing
    expect(revenuePvm([], [])).toBeNull();
  });

  it("splits a single segment into volume and price", () => {
    const r = segmentPriceVolume({ key: "A", units: 120, revenue: 1_080, cogs: 0 }, budget[0]);
    expect(r.volume).toBeCloseTo(200); // +20 units × 10 kr.
    expect(r.price).toBeCloseTo(-120); // −1 kr. × 120 units
  });
});

describe("gross profit bridge", () => {
  it("separates volume, price and unit cost and adds up to the GP variance", () => {
    const actual: Segment[] = [
      { key: "A", units: 110, revenue: 1_210, cogs: 627 }, // price 11 (+1), cost 5,7 (−0,3)
      { key: "B", units: 90, revenue: 1_800, cogs: 945 }, // price 20, cost 10,5 (+0,5)
    ];
    const g = grossProfitBridge(actual, budget);
    expect(g).not.toBeNull();
    if (!g) return;
    expect(g.volumeMix).toBeCloseTo(10 * 4 + -10 * 10); // −60
    expect(g.price).toBeCloseTo(110 * 1); // +110
    expect(g.unitCost).toBeCloseTo(110 * 0.3 - 90 * 0.5); // −12
    expect(g.volumeMix + g.price + g.unitCost).toBeCloseTo(g.total);
    expect(g.total).toBe(1_210 - 627 + 1_800 - 945 - 1_400);
  });
});

describe("materiality", () => {
  it("requires both the % and the DKK threshold for amounts", () => {
    expect(isMaterialAmount(100_000, 0.05)).toBe(true);
    expect(isMaterialAmount(10_000, 0.4)).toBe(false); // big %, tiny amount
    expect(isMaterialAmount(200_000, 0.004)).toBe(false); // big amount, tiny %
    expect(isMaterialAmount(200_000, null)).toBe(true); // no budget to compare % with
    expect(isMaterialAmount(null, null)).toBe(false);
  });
  it("treats variances of 1 mio. kr. or more as material even below 1 %", () => {
    expect(isMaterialAmount(2_550_000, -0.006)).toBe(true); // FY2024 revenue miss
    expect(isMaterialAmount(-1_000_000, 0.001)).toBe(true);
    expect(isMaterialAmount(999_999, 0.005)).toBe(false);
  });
  it("uses a percentage-point threshold for ratios", () => {
    expect(isMaterialRatio(0.002)).toBe(true);
    expect(isMaterialRatio(-0.0004)).toBe(false);
  });
  it("makes immaterial variances neutral in comparisons", () => {
    expect(compare(1_000_010_000, 1_000_000_000, "higher-is-better").status).toBe("neutral");
    expect(compare(0.5204, 0.52, "higher-is-better", "ratio").status).toBe("neutral");
    expect(compare(1_200_000, 1_000_000, "lower-is-better").status).toBe("unfavorable");
    expect(compare(105, 100, "higher-is-better", "driver").status).toBe("favorable");
    expect(compare(100.5, 100, "higher-is-better", "driver").status).toBe("neutral");
  });
  it("exposes the default thresholds", () => {
    expect(DEFAULT_MATERIALITY).toEqual({ percent: 0.01, absoluteDkk: 50_000, alwaysMaterialDkk: 1_000_000, ratio: 0.001 });
  });
});

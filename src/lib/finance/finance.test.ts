import { describe, expect, it } from "vitest";
import type { FinancialRecord } from "@/lib/data/schema";
import { pnlInputs, sumAmount, sumUnits } from "./aggregate";
import {
  averageSellingPrice,
  computeMetrics,
  ebitda,
  grossProfit,
  margin,
  revenueFromDrivers,
} from "./metrics";
import {
  addMonths,
  periodLabel,
  periodRange,
  previousPeriod,
  sameMonthLastYear,
  ytdPeriods,
} from "./periods";
import { safeDivide, safeSubtract, sumStrict } from "./safe-math";
import {
  absoluteVariance,
  compare,
  favorability,
  percentVariance,
} from "./variance";

describe("safe-math", () => {
  it("divides normally", () => expect(safeDivide(10, 4)).toBe(2.5));
  it("returns null for zero denominator", () => expect(safeDivide(10, 0)).toBeNull());
  it("returns null for missing values", () => {
    expect(safeDivide(null, 5)).toBeNull();
    expect(safeDivide(5, null)).toBeNull();
  });
  it("returns null for non-finite inputs", () => expect(safeDivide(Infinity, 2)).toBeNull());
  it("subtracts and propagates null", () => {
    expect(safeSubtract(5, 8)).toBe(-3);
    expect(safeSubtract(5, null)).toBeNull();
  });
  it("sums strictly", () => {
    expect(sumStrict([1, 2, 3])).toBe(6);
    expect(sumStrict([])).toBeNull();
    expect(sumStrict([1, null, 3])).toBeNull();
  });
});

describe("periods", () => {
  it("shifts across year boundaries", () => {
    expect(addMonths("2025-01", -1)).toBe("2024-12");
    expect(addMonths("2024-12", 1)).toBe("2025-01");
    expect(addMonths("2025-06", -18)).toBe("2023-12");
    expect(previousPeriod("2025-03")).toBe("2025-02");
    expect(sameMonthLastYear("2025-03")).toBe("2024-03");
  });
  it("builds ranges and YTD", () => {
    expect(periodRange("2024-11", "2025-02")).toEqual(["2024-11", "2024-12", "2025-01", "2025-02"]);
    expect(periodRange("2025-02", "2025-01")).toEqual([]);
    expect(ytdPeriods("2025-03")).toEqual(["2025-01", "2025-02", "2025-03"]);
    expect(ytdPeriods("2025-01")).toEqual(["2025-01"]);
  });
  it("labels periods and rejects invalid ones", () => {
    expect(periodLabel("2025-10")).toBe("Oct 2025");
    expect(() => addMonths("2025-13", 1)).toThrow();
  });
});

describe("metrics", () => {
  it("revenue = units × ASP", () => {
    expect(revenueFromDrivers(1_000, 249.5)).toBe(249_500);
    expect(revenueFromDrivers(null, 249.5)).toBeNull();
  });
  it("ASP = revenue / units, null for zero units", () => {
    expect(averageSellingPrice(249_500, 1_000)).toBe(249.5);
    expect(averageSellingPrice(1_000, 0)).toBeNull();
  });
  it("gross profit and EBITDA can be negative", () => {
    expect(grossProfit(100, 130)).toBe(-30);
    expect(ebitda(-30, 50)).toBe(-80);
  });
  it("margin is null when revenue is zero, negative or missing", () => {
    expect(margin(25, 100)).toBe(0.25);
    expect(margin(-10, 100)).toBe(-0.1);
    expect(margin(10, 0)).toBeNull();
    expect(margin(10, -50)).toBeNull();
    expect(margin(10, null)).toBeNull();
  });
  it("computes a full P&L and excludes D&A from EBITDA", () => {
    const m = computeMetrics({ revenue: 1_000, cogs: 600, opex: 300, da: 50, units: 10 });
    expect(m.grossProfit).toBe(400);
    expect(m.grossMargin).toBe(0.4);
    expect(m.ebitda).toBe(100); // not 50: D&A is excluded
    expect(m.ebitdaMargin).toBe(0.1);
    expect(m.averageSellingPrice).toBe(100);
  });
  it("propagates missing inputs instead of treating them as zero", () => {
    const m = computeMetrics({ revenue: 1_000, cogs: null, opex: 300, da: null, units: null });
    expect(m.grossProfit).toBeNull();
    expect(m.ebitda).toBeNull();
    expect(m.grossMargin).toBeNull();
  });
});

describe("variance", () => {
  it("absolute and percentage variance", () => {
    expect(absoluteVariance(110, 100)).toBe(10);
    expect(percentVariance(110, 100)).toBeCloseTo(0.1);
    expect(percentVariance(90, 100)).toBeCloseTo(-0.1);
  });
  it("percentage variance is null for zero or missing budget", () => {
    expect(percentVariance(50, 0)).toBeNull();
    expect(percentVariance(50, null)).toBeNull();
    expect(percentVariance(null, 100)).toBeNull();
  });
  it("uses |budget| so a smaller-than-planned loss is a positive variance", () => {
    // Budget EBITDA −1.000.000, actual −500.000 → 500.000 better than budget = +50 %
    expect(percentVariance(-500_000, -1_000_000)).toBeCloseTo(0.5);
    expect(percentVariance(-1_500_000, -1_000_000)).toBeCloseTo(-0.5);
  });
  it("favorability depends on direction, not sign", () => {
    expect(favorability(10, "higher-is-better")).toBe("favorable");
    expect(favorability(-10, "higher-is-better")).toBe("unfavorable");
    expect(favorability(10, "lower-is-better")).toBe("unfavorable"); // cost overrun
    expect(favorability(-10, "lower-is-better")).toBe("favorable"); // cost saving
    expect(favorability(0, "higher-is-better")).toBe("neutral");
    expect(favorability(null, "lower-is-better")).toBe("neutral");
  });
  it("compares ratios in percentage points without a % variance", () => {
    const c = compare(0.42, 0.4, "higher-is-better", "ratio");
    expect(c.absolute).toBeCloseTo(0.02);
    expect(c.percent).toBeNull();
    expect(c.status).toBe("favorable");
  });
});

describe("aggregate", () => {
  const base = { category: null, channel: null, department: null, units: null } as const;
  const records: FinancialRecord[] = [
    { ...base, period: "2025-01", scenario: "actual", accountId: "REV", category: "fashion", channel: "stores", amountDkk: 1_000, units: 10 },
    { ...base, period: "2025-01", scenario: "actual", accountId: "REV", category: "home-living", channel: "ecommerce", amountDkk: 2_000, units: 5 },
    { ...base, period: "2025-01", scenario: "actual", accountId: "COGS", category: "fashion", channel: "stores", amountDkk: 400 },
    { ...base, period: "2025-01", scenario: "actual", accountId: "OPEX_RENT", department: "stores", amountDkk: 300 },
    { ...base, period: "2025-01", scenario: "actual", accountId: "DA", department: "stores", amountDkk: 100 },
    { ...base, period: "2025-02", scenario: "actual", accountId: "REV", category: "fashion", channel: "stores", amountDkk: 1_500, units: 12 },
    { ...base, period: "2025-01", scenario: "budget", accountId: "REV", category: "fashion", channel: "stores", amountDkk: 900, units: 9 },
  ];

  it("sums by scenario, period and account type", () => {
    expect(sumAmount(records, { scenario: "actual", periods: ["2025-01"], accountTypes: ["revenue"] })).toBe(3_000);
    expect(sumAmount(records, { scenario: "actual", periods: ["2025-01", "2025-02"], accountTypes: ["revenue"] })).toBe(4_500);
    expect(sumAmount(records, { scenario: "budget", periods: ["2025-01"], accountTypes: ["revenue"] })).toBe(900);
  });
  it("filters by dimension", () => {
    expect(sumAmount(records, { scenario: "actual", periods: ["2025-01"], accountTypes: ["revenue"], category: "fashion" })).toBe(1_000);
    expect(sumAmount(records, { scenario: "actual", periods: ["2025-01"], accountTypes: ["revenue"], channel: "ecommerce" })).toBe(2_000);
  });
  it("returns null (missing) when nothing matches", () => {
    expect(sumAmount(records, { scenario: "actual", periods: ["2023-01"], accountTypes: ["revenue"] })).toBeNull();
  });
  it("sums units from revenue rows only", () => {
    expect(sumUnits(records, { scenario: "actual", periods: ["2025-01"] })).toBe(15);
  });
  it("builds P&L inputs with EBITDA excluding D&A", () => {
    const inputs = pnlInputs(records, { scenario: "actual", periods: ["2025-01"] });
    expect(inputs).toEqual({ revenue: 3_000, cogs: 400, opex: 300, da: 100, units: 15 });
    expect(computeMetrics(inputs).ebitda).toBe(2_300);
  });
});

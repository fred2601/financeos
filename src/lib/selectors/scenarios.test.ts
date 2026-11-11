import { describe, expect, it } from "vitest";
import { getDataset } from "@/lib/data/dataset";
import { pnlInputs } from "@/lib/finance/aggregate";
import { computeMetrics } from "@/lib/finance/metrics";
import { periodRange } from "@/lib/finance/periods";
import {
  leversToAssumptions,
  scenarioEbitda,
  SCENARIO_IDS,
  SCENARIO_PRESETS,
  sensitivity,
  type ScenarioSet,
} from "@/lib/finance/scenarios";
import { getForecastBase } from "./forecast";
import { buildScenarioView, isPresetScenarios, parseScenarios, scenariosToQuery } from "./scenarios";

const base = getForecastBase(getDataset());
const fy = computeMetrics(pnlInputs(getDataset().records, { scenario: "actual", periods: periodRange("2025-01", "2025-12") }));
const totals = { revenue: fy.revenue, grossProfit: fy.grossProfit, opex: fy.opex };
const ZERO = { salesGrowth: 0, marginChange: 0, opexChange: 0 };

describe("scenario levers", () => {
  it("map onto forecast drivers: sales growth as volume, margin in pp, one opex rate", () => {
    const a = leversToAssumptions({ salesGrowth: 0.05, marginChange: -0.01, opexChange: 0.02 });
    expect(a.categories.fashion).toEqual({ unitGrowth: 0.05, priceChange: 0, marginChange: -0.01 });
    expect(Object.values(a.opex).every((v) => v === 0.02)).toBe(true);
  });

  it("closed-form EBITDA: zero levers give the base year", () => {
    expect(scenarioEbitda(totals, ZERO)).toBeCloseTo(fy.ebitda ?? NaN, 4);
    expect(scenarioEbitda({ revenue: null, grossProfit: 1, opex: 1 }, ZERO)).toBeNull();
  });

  it("closed-form EBITDA on a hand-calculated example", () => {
    // Revenue 1.000, GP 500, opex 400: +10 % sales, +2 pp margin, +5 % opex
    // → 1,1 × (500 + 0,02 × 1.000) − 1,05 × 400 = 572 − 420 = 152
    expect(scenarioEbitda({ revenue: 1_000, grossProfit: 500, opex: 400 }, { salesGrowth: 0.1, marginChange: 0.02, opexChange: 0.05 })).toBeCloseTo(152, 10);
  });

  it("sensitivities match the formula: +1 % sales, +1 pp margin, +1 % opex", () => {
    const l = { salesGrowth: 0.04, marginChange: 0.005, opexChange: 0.03 };
    const s = sensitivity({ revenue: 1_000, grossProfit: 500, opex: 400 }, l);
    expect(s.sales).toBeCloseTo(0.01 * (500 + 0.005 * 1_000), 10); // 5,05
    expect(s.margin).toBeCloseTo(0.01 * 1_000 * 1.04, 10); // 10,4
    expect(s.opex).toBeCloseTo(-0.01 * 400, 10); // −4
  });
});

describe("scenario view-model", () => {
  const vm = buildScenarioView(base, SCENARIO_PRESETS);

  it("engine result equals the closed-form EBITDA for every scenario", () => {
    for (const s of vm.scenarios) expect(s.metrics.ebitda.actual).toBeCloseTo(s.ebitdaFormula ?? NaN, 2);
  });

  it("revenue grows exactly by the sales lever; gross margin moves by the pp lever", () => {
    for (const s of vm.scenarios) {
      expect(s.metrics.revenue.actual).toBeCloseTo((fy.revenue ?? NaN) * (1 + s.levers.salesGrowth), 2);
      expect(s.metrics.grossMargin.actual).toBeCloseTo((fy.grossMargin ?? NaN) + s.levers.marginChange, 10);
      expect(s.metrics.opex.actual).toBeCloseTo((fy.opex ?? NaN) * (1 + s.levers.opexChange), 2);
    }
  });

  it("presets are ordered worst < base < best and raise no warning", () => {
    const [w, b, x] = SCENARIO_IDS.map((id) => vm.scenarios.find((s) => s.id === id)?.metrics.ebitda.actual ?? NaN);
    expect(w).toBeLessThan(b);
    expect(b).toBeLessThan(x);
    expect(vm.orderingWarning).toBe(false);
  });

  it("warns when worst case EBITDA beats the base case", () => {
    const set: ScenarioSet = { ...SCENARIO_PRESETS, worst: { salesGrowth: 0.2, marginChange: 0.05, opexChange: 0 } };
    expect(buildScenarioView(base, set).orderingWarning).toBe(true);
  });

  it("comparison table, bars and monthly series are consistent", () => {
    const row = vm.comparison.find((r) => r.key === "ebitda");
    expect(row?.baseYear).toBeCloseTo(fy.ebitda ?? NaN, 2);
    expect(row?.spread).toBeCloseTo((row?.values.best ?? NaN) - (row?.values.worst ?? NaN), 6);
    expect(vm.ebitdaBars.map((b) => b.id)).toEqual(["baseYear", "worst", "base", "best"]);
    for (const id of SCENARIO_IDS) {
      const monthly = vm.monthly.reduce((s, m) => s + (m[id] ?? NaN), 0);
      expect(monthly).toBeCloseTo(row?.values[id] ?? NaN, 2);
    }
  });

  it("sensitivity is computed for the base case", () => {
    expect(vm.sensitivity.opex).toBeCloseTo(-0.01 * (fy.opex ?? NaN), 4);
  });
});

describe("scenarios in the URL", () => {
  it("round-trips, including negative and decimal values", () => {
    const set = parseScenarios({ worst: "-7.5,-2.25,6", base: "3.33,0,2.5", best: "12,1.75,-1" });
    const query = scenariosToQuery(set);
    expect(query).toBe("worst=-7.5,-2.25,6&base=3.33,0,2.5&best=12,1.75,-1");
    expect(parseScenarios(Object.fromEntries(new URLSearchParams(query)))).toEqual(set);
  });

  it("uses presets for missing or invalid values and clamps extremes", () => {
    expect(parseScenarios({})).toEqual(SCENARIO_PRESETS);
    expect(isPresetScenarios(parseScenarios({}))).toBe(true);
    const s = parseScenarios({ best: "500,x,-90" });
    expect(s.best.salesGrowth).toBe(1);
    expect(s.best.marginChange).toBe(SCENARIO_PRESETS.best.marginChange);
    expect(s.best.opexChange).toBe(-0.5);
  });
});

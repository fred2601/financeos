import { describe, expect, it } from "vitest";
import { getDataset } from "@/lib/data/dataset";
import { pnlInputs } from "@/lib/finance/aggregate";
import { DEFAULT_ASSUMPTIONS, type ForecastAssumptions } from "@/lib/finance/forecast";
import { computeMetrics } from "@/lib/finance/metrics";
import { periodRange } from "@/lib/finance/periods";
import {
  assumptionsToSearchParams,
  buildForecastView,
  getForecastBase,
  isDefaultAssumptions,
  parseAssumptions,
} from "./forecast";

const dataset = getDataset();
const base = getForecastBase(dataset);
const fy2025 = computeMetrics(pnlInputs(dataset.records, { scenario: "actual", periods: periodRange("2025-01", "2025-12") }));

const flat: ForecastAssumptions = parseAssumptions({ units: "0,0,0", price: "0,0,0", margin: "0,0,0", opex: "0,0,0,0,0,0" });
const kpi = (vm: ReturnType<typeof buildForecastView>, key: string) => vm.kpis.find((k) => k.key === key)?.comparison;

describe("forecast base and view-model", () => {
  it("uses FY2025 actuals as the base and forecasts FY2026", () => {
    expect(base.baseYear).toBe(2025);
    expect(base.forecastYear).toBe(2026);
    expect(base.months).toHaveLength(12);
  });

  it("with flat assumptions the forecast equals FY2025 actual", () => {
    const vm = buildForecastView(base, flat);
    expect(kpi(vm, "revenue")?.actual).toBeCloseTo(fy2025.revenue ?? NaN, 2);
    expect(kpi(vm, "revenue")?.reference).toBeCloseTo(fy2025.revenue ?? NaN, 2);
    expect(kpi(vm, "ebitda")?.actual).toBeCloseTo(fy2025.ebitda ?? NaN, 2);
  });

  it("annual formulas hold exactly: revenue = units × ASP and GM = base GM + change", () => {
    const a = parseAssumptions({ units: "5,-3,10", price: "2,4,-1", margin: "1,-0.5,0" });
    const vm = buildForecastView(base, a);
    for (const c of vm.categories) {
      expect((c.unitsForecast ?? 0) * (c.aspForecast ?? 0)).toBeCloseTo(c.revenueForecast ?? NaN, 2);
      expect(c.unitsForecast).toBeCloseTo((c.unitsBase ?? 0) * (1 + c.unitGrowth), 4);
      expect(c.aspForecast).toBeCloseTo((c.aspBase ?? 0) * (1 + c.priceChange), 6);
      expect(c.grossMarginForecast).toBeCloseTo((c.grossMarginBase ?? 0) + c.marginChange, 10);
    }
  });

  it("EBITDA = gross profit − opex, and monthly rows add up to the year", () => {
    const vm = buildForecastView(base, DEFAULT_ASSUMPTIONS);
    const gp = vm.categories.reduce((s, c) => s + (c.grossProfitForecast ?? 0), 0);
    expect(vm.ebitda.forecast).toBeCloseTo(gp - (vm.opexTotal.forecast ?? 0), 2);
    const monthly = vm.months.reduce((s, m) => s + (m.ebitda ?? 0), 0);
    expect(monthly).toBeCloseTo(vm.ebitda.forecast ?? NaN, 2);
    expect(vm.chart).toHaveLength(12);
  });

  it("10 % higher personnel costs reduce EBITDA by 10 % of FY2025 personnel costs", () => {
    const more = parseAssumptions({ units: "0,0,0", price: "0,0,0", margin: "0,0,0", opex: "10,0,0,0,0,0" });
    const personnel = buildForecastView(base, flat).opex.find((o) => o.id === "OPEX_PERSONNEL")?.base ?? NaN;
    const diff = (buildForecastView(base, flat).ebitda.forecast ?? 0) - (buildForecastView(base, more).ebitda.forecast ?? 0);
    expect(diff).toBeCloseTo(personnel * 0.1, 2);
  });
});

describe("assumptions in the URL", () => {
  it("round-trips through search params", () => {
    const a = parseAssumptions({ units: "5,-3,10", price: "2.5,4,-1", margin: "1,-0.5,0", opex: "3.5,2,3,3,5,2" });
    const params = Object.fromEntries(assumptionsToSearchParams(a));
    expect(parseAssumptions(params)).toEqual(a);
    expect(params.units).toBe("5,-3,10");
  });

  it("falls back to defaults for missing or invalid values and clamps extremes", () => {
    expect(parseAssumptions({})).toEqual(DEFAULT_ASSUMPTIONS);
    expect(isDefaultAssumptions(parseAssumptions({}))).toBe(true);
    const a = parseAssumptions({ units: "abc,500,", margin: "-90" });
    expect(a.categories["home-living"].unitGrowth).toBe(DEFAULT_ASSUMPTIONS.categories["home-living"].unitGrowth);
    expect(a.categories.fashion.unitGrowth).toBe(1); // clamped to +100 %
    expect(a.categories["outdoor-sport"].unitGrowth).toBe(DEFAULT_ASSUMPTIONS.categories["outdoor-sport"].unitGrowth);
    expect(a.categories["home-living"].marginChange).toBe(-0.2); // clamped to −20 pp
  });
});

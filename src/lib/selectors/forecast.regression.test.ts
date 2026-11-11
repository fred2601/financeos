/**
 * Milestone 3 financial QA — regression tests for the driver-based forecast.
 * Each describe block maps to one QA check (see docs/qa/m3-forecast-qa.md).
 */
import { describe, expect, it } from "vitest";
import { getDataset } from "@/lib/data/dataset";
import { CATEGORY_IDS, type CategoryId } from "@/lib/data/schema";
import {
  DEFAULT_ASSUMPTIONS,
  forecastCategoryMonth,
  forecastYear,
  OPEX_ACCOUNT_IDS,
  type ForecastAssumptions,
  type OpexAccountId,
} from "@/lib/finance/forecast";
import {
  assumptionsToSearchParams,
  buildForecastView,
  getForecastBase,
  parseAssumptions,
} from "./forecast";

const base = getForecastBase(getDataset());
const TOL = 1e-6; // kroner; amounts are compared to well below 1 øre

const FLAT: ForecastAssumptions = {
  categories: Object.fromEntries(
    CATEGORY_IDS.map((c) => [c, { unitGrowth: 0, priceChange: 0, marginChange: 0 }]),
  ) as ForecastAssumptions["categories"],
  opex: Object.fromEntries(OPEX_ACCOUNT_IDS.map((id) => [id, 0])) as ForecastAssumptions["opex"],
};

const MIXED = parseAssumptions({
  units: "7.5,-4,12",
  price: "-2,3.25,1",
  margin: "1.5,-2,0.75",
  opex: "4,-3,10,0,-1.5,6",
});

const SCENARIOS: [string, ForecastAssumptions][] = [
  ["flat", FLAT],
  ["defaults", DEFAULT_ASSUMPTIONS],
  ["mixed incl. negatives", MIXED],
];

const close = (a: number | null, b: number | null, tol = TOL) => {
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  expect(Math.abs((a ?? NaN) - (b ?? NaN))).toBeLessThanOrEqual(tol);
};

const withCategory = (c: CategoryId, patch: Partial<ForecastAssumptions["categories"][CategoryId]>): ForecastAssumptions => ({
  ...FLAT,
  categories: { ...FLAT.categories, [c]: { ...FLAT.categories[c], ...patch } },
});
const withOpex = (id: OpexAccountId, growth: number): ForecastAssumptions => ({ ...FLAT, opex: { ...FLAT.opex, [id]: growth } });

describe("QA 1 · revenue = units × ASP for every category and month", () => {
  it.each(SCENARIOS)("%s", (_, a) => {
    const fc = forecastYear(base.months, a);
    fc.forEach((m, i) => {
      for (const c of CATEGORY_IDS) {
        const b = base.months[i].categories[c];
        const f = m.categories[c];
        const aspBase = (b.revenue ?? NaN) / (b.units ?? NaN);
        const aspF = aspBase * (1 + a.categories[c].priceChange);
        close(f.units, (b.units ?? NaN) * (1 + a.categories[c].unitGrowth));
        close(f.revenue, (f.units ?? NaN) * aspF, 1e-4);
      }
    });
    // Annual, per category
    for (const row of buildForecastView(base, a).categories) {
      close(row.revenueForecast, (row.unitsForecast ?? NaN) * (row.aspForecast ?? NaN), 1e-4);
    }
  });
});

describe("QA 2 · gross profit, opex and EBITDA reconcile monthly and annually", () => {
  it.each(SCENARIOS)("%s", (_, a) => {
    const vm = buildForecastView(base, a);
    const fc = forecastYear(base.months, a);
    fc.forEach((m, i) => {
      const revenue = CATEGORY_IDS.reduce((s, c) => s + (m.categories[c].revenue ?? NaN), 0);
      const cogs = CATEGORY_IDS.reduce((s, c) => s + (m.categories[c].cogs ?? NaN), 0);
      const opex = OPEX_ACCOUNT_IDS.reduce((s, id) => s + (m.opex[id] ?? NaN), 0);
      const row = vm.months[i];
      close(row.revenue, revenue, 1e-4);
      close(row.grossProfit, revenue - cogs, 1e-4);
      close(row.opex, opex, 1e-4);
      close(row.ebitda, revenue - cogs - opex, 1e-4);
      close(row.ebitda, (row.grossProfit ?? NaN) - (row.opex ?? NaN), 1e-4);
    });
    const gp = vm.categories.reduce((s, c) => s + (c.grossProfitForecast ?? NaN), 0);
    const opex = vm.opex.reduce((s, o) => s + (o.forecast ?? NaN), 0);
    close(vm.grossProfit.forecast, gp, 1e-4);
    close(vm.opexTotal.forecast, opex, 1e-4);
    close(vm.ebitda.forecast, gp - opex, 1e-4);
    const kpi = (k: string) => vm.kpis.find((x) => x.key === k)?.comparison.actual ?? null;
    close(kpi("ebitda"), vm.ebitda.forecast, 1e-4);
    close(kpi("ebitdaMargin"), (vm.ebitda.forecast ?? NaN) / (kpi("revenue") ?? NaN), 1e-12);
    close(kpi("grossMargin"), gp / (kpi("revenue") ?? NaN), 1e-12);
  });
});

describe("QA 3 · each assumption changed on its own (incl. zero and negative)", () => {
  const flat = buildForecastView(base, FLAT);
  const cat = (vm: ReturnType<typeof buildForecastView>, c: CategoryId) => vm.categories.find((x) => x.id === c);

  it("flat (all zero) assumptions reproduce the base year exactly", () => {
    for (const c of flat.categories) {
      close(c.revenueForecast, c.revenueBase, 1e-4);
      close(c.grossProfitForecast, c.grossProfitBase, 1e-4);
      close(c.unitsForecast, c.unitsBase, 1e-6);
    }
    close(flat.ebitda.forecast, flat.ebitda.base, 1e-4);
    close(flat.opexTotal.forecast, flat.opexTotal.base, 1e-4);
  });

  for (const c of CATEGORY_IDS) {
    for (const g of [0.1, -0.1, -0.5]) {
      it(`${c}: unit growth ${g * 100} % scales units, revenue and GP; margin and other categories unchanged`, () => {
        const vm = buildForecastView(base, withCategory(c, { unitGrowth: g }));
        const r = cat(vm, c);
        const f = cat(flat, c);
        close(r?.unitsForecast ?? null, (f?.unitsForecast ?? NaN) * (1 + g), 1e-6);
        close(r?.revenueForecast ?? null, (f?.revenueForecast ?? NaN) * (1 + g), 1e-4);
        close(r?.grossProfitForecast ?? null, (f?.grossProfitForecast ?? NaN) * (1 + g), 1e-4);
        close(r?.grossMarginForecast ?? null, f?.grossMarginForecast ?? null, 1e-12);
        close(r?.aspForecast ?? null, f?.aspForecast ?? null, 1e-9);
        for (const other of CATEGORY_IDS.filter((x) => x !== c)) close(cat(vm, other)?.revenueForecast ?? null, cat(flat, other)?.revenueForecast ?? null, 1e-6);
        close(vm.opexTotal.forecast, flat.opexTotal.forecast, 1e-6);
      });
    }
    for (const p of [0.05, -0.05]) {
      it(`${c}: price change ${p * 100} % scales ASP and revenue, units unchanged`, () => {
        const r = cat(buildForecastView(base, withCategory(c, { priceChange: p })), c);
        const f = cat(flat, c);
        close(r?.unitsForecast ?? null, f?.unitsForecast ?? null, 1e-6);
        close(r?.aspForecast ?? null, (f?.aspForecast ?? NaN) * (1 + p), 1e-9);
        close(r?.revenueForecast ?? null, (f?.revenueForecast ?? NaN) * (1 + p), 1e-4);
        close(r?.grossMarginForecast ?? null, f?.grossMarginForecast ?? null, 1e-12);
      });
    }
  }

  for (const id of OPEX_ACCOUNT_IDS) {
    for (const g of [0.1, -0.1, 0]) {
      it(`${id}: cost growth ${g * 100} % changes only that account and EBITDA by the same amount`, () => {
        const vm = buildForecastView(base, withOpex(id, g));
        const acct = vm.opex.find((o) => o.id === id);
        close(acct?.forecast ?? null, (acct?.base ?? NaN) * (1 + g), 1e-4);
        for (const o of vm.opex.filter((x) => x.id !== id)) close(o.forecast, o.base, 1e-6);
        close(vm.ebitda.forecast, (flat.ebitda.forecast ?? NaN) - (acct?.base ?? NaN) * g, 1e-4);
        close(vm.grossProfit.forecast, flat.grossProfit.forecast, 1e-6);
      });
    }
  }
});

describe("QA 4 · monthly forecast reconciles to annual totals", () => {
  it.each(SCENARIOS)("%s", (_, a) => {
    const vm = buildForecastView(base, a);
    const sum = (k: "revenue" | "grossProfit" | "opex" | "ebitda") => vm.months.reduce((s, m) => s + (m[k] ?? NaN), 0);
    const kpi = (k: string) => vm.kpis.find((x) => x.key === k)?.comparison.actual ?? null;
    close(sum("revenue"), kpi("revenue"), 1e-4);
    close(sum("grossProfit"), kpi("grossProfit"), 1e-4);
    close(sum("opex"), kpi("opex"), 1e-4);
    close(sum("ebitda"), kpi("ebitda"), 1e-4);
    close(
      vm.chart.reduce((s, p) => s + (p.revenueForecast ?? NaN), 0),
      kpi("revenue"),
      1e-4,
    );
    expect(vm.months).toHaveLength(12);
  });
});

describe("QA 5 · gross margin assumptions are percentage points, not relative %", () => {
  it.each(CATEGORY_IDS)("%s: +2 pp adds 0,02 to the margin (not × 1,02)", (c) => {
    const vm = buildForecastView(base, withCategory(c, { marginChange: 0.02 }));
    const row = vm.categories.find((x) => x.id === c);
    const baseGm = row?.grossMarginBase ?? NaN;
    close(row?.grossMarginForecast ?? null, baseGm + 0.02, 1e-12);
    expect(Math.abs((row?.grossMarginForecast ?? NaN) - baseGm * 1.02)).toBeGreaterThan(0.005);
  });

  it("applies the pp change to every month, so seasonal margin dips are kept", () => {
    const a = withCategory("fashion", { marginChange: -0.01 });
    const fc = forecastYear(base.months, a);
    fc.forEach((m, i) => {
      const b = base.months[i].categories.fashion;
      const gmBase = ((b.revenue ?? NaN) - (b.cogs ?? NaN)) / (b.revenue ?? NaN);
      const f = m.categories.fashion;
      close(((f.revenue ?? NaN) - (f.cogs ?? NaN)) / (f.revenue ?? NaN), gmBase - 0.01, 1e-12);
    });
  });

  it("URL and parser treat margin values as pp: margin=1.5 → 0,015", () => {
    expect(parseAssumptions({ margin: "1.5,0,0" }).categories["home-living"].marginChange).toBeCloseTo(0.015, 12);
  });
});

describe("QA 6 · seasonality is preserved", () => {
  it.each(SCENARIOS)("%s: each category keeps its base-year monthly revenue profile", (_, a) => {
    const fc = forecastYear(base.months, a);
    for (const c of CATEGORY_IDS) {
      const baseTotal = base.months.reduce((s, m) => s + (m.categories[c].revenue ?? NaN), 0);
      const fcTotal = fc.reduce((s, m) => s + (m.categories[c].revenue ?? NaN), 0);
      fc.forEach((m, i) => {
        const shareBase = (base.months[i].categories[c].revenue ?? NaN) / baseTotal;
        close((m.categories[c].revenue ?? NaN) / fcTotal, shareBase, 1e-12);
      });
    }
  });

  it("company-level profile shifts only through category mix (documented)", () => {
    const vm = buildForecastView(base, withCategory("outdoor-sport", { unitGrowth: 0.3 }));
    const total = vm.months.reduce((s, m) => s + (m.revenue ?? 0), 0);
    const baseTotal = vm.chart.reduce((s, p) => s + (p.revenueBase ?? 0), 0);
    const june = vm.months[5].revenue ?? 0;
    const juneBase = vm.chart[5].revenueBase ?? 0;
    // Outdoor peaks in summer, so faster outdoor growth raises June's share of the year.
    expect(june / total).toBeGreaterThan(juneBase / baseTotal);
  });
});

describe("QA 7 · shared URL reproduces the same assumptions", () => {
  const cases: [string, ForecastAssumptions][] = [
    ["defaults", DEFAULT_ASSUMPTIONS],
    ["mixed", MIXED],
    ["bounds", parseAssumptions({ units: "-50,100,0", price: "-50,100,0", margin: "-20,20,0", opex: "-50,100,0,0,0,0" })],
    ["fine steps", parseAssumptions({ units: "0.01,3.33,-0.25", price: "1.75,0.5,2.25", margin: "0.25,-0.75,0.01", opex: "3.33,2.5,0.01,9.99,-0.5,1.25" })],
  ];
  it.each(cases)("%s: round-trips exactly, including the comma-unescaped form used in links", (_, a) => {
    const query = assumptionsToSearchParams(a).toString().replaceAll("%2C", ",");
    const parsed = parseAssumptions(Object.fromEntries(new URLSearchParams(query)));
    expect(parsed).toEqual(a);
    expect(buildForecastView(base, parsed).ebitda.forecast).toBe(buildForecastView(base, a).ebitda.forecast);
  });
});

describe("QA edge cases · zero and inconsistent base data", () => {
  it("zero base revenue with costs keeps the costs (scaled by volume) instead of dropping them to 0", () => {
    const f = forecastCategoryMonth({ units: 0, revenue: 0, cogs: 500 }, { unitGrowth: 0.1, priceChange: 0.05, marginChange: 0.01 });
    expect(f.revenue).toBe(0);
    expect(f.cogs).toBeCloseTo(550, 10);
  });

  it("revenue without units has no ASP, so the forecast is not available (null), not invented", () => {
    const f = forecastCategoryMonth({ units: 0, revenue: 1_000, cogs: 500 }, DEFAULT_ASSUMPTIONS.categories.fashion);
    expect(f).toEqual({ units: null, revenue: null, cogs: null });
  });

  it("all-zero base month forecasts zero", () => {
    expect(forecastCategoryMonth({ units: 0, revenue: 0, cogs: 0 }, DEFAULT_ASSUMPTIONS.categories.fashion)).toEqual({ units: 0, revenue: 0, cogs: 0 });
  });
});

/**
 * Milestone 4 financial QA — regression tests for the scenario simulator.
 * See docs/qa/m4-scenarios-qa.md for the findings these tests cover.
 */
import { describe, expect, it } from "vitest";
import { getDataset } from "@/lib/data/dataset";
import { CATEGORY_IDS } from "@/lib/data/schema";
import { DEFAULT_ASSUMPTIONS, forecastYear, OPEX_ACCOUNT_IDS } from "@/lib/finance/forecast";
import {
  leversToAssumptions,
  SCENARIO_IDS,
  SCENARIO_PRESETS,
  sensitivity,
  type ScenarioLevers,
  type ScenarioSet,
} from "@/lib/finance/scenarios";
import { buildForecastView, getForecastBase } from "./forecast";
import { buildScenarioView, parseScenarios, scenariosToQuery } from "./scenarios";

const base = getForecastBase(getDataset());
const all = (l: ScenarioLevers): ScenarioSet => ({ worst: l, base: l, best: l });
const close = (a: number | null, b: number | null, tol = 1e-4) => {
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  expect(Math.abs((a ?? NaN) - (b ?? NaN))).toBeLessThanOrEqual(tol);
};

// FY2025 totals computed independently from the base months (not via the view-model).
const sumBase = (f: (m: (typeof base.months)[number]) => number) => base.months.reduce((s, m) => s + f(m), 0);
const REV0 = sumBase((m) => CATEGORY_IDS.reduce((s, c) => s + (m.categories[c].revenue ?? NaN), 0));
const COGS0 = sumBase((m) => CATEGORY_IDS.reduce((s, c) => s + (m.categories[c].cogs ?? NaN), 0));
const OPEX0 = sumBase((m) => OPEX_ACCOUNT_IDS.reduce((s, id) => s + (m.opex[id] ?? NaN), 0));
const GP0 = REV0 - COGS0;
const TOTALS = { revenue: REV0, grossProfit: GP0, opex: OPEX0 };

/** Independent full-year P&L for a scenario, straight from the definitions. */
function independent(l: ScenarioLevers) {
  const revenue = REV0 * (1 + l.salesGrowth);
  const grossProfit = (1 + l.salesGrowth) * GP0 + l.marginChange * revenue;
  const opex = OPEX0 * (1 + l.opexChange);
  return { revenue, grossProfit, cogs: revenue - grossProfit, opex, ebitda: grossProfit - opex };
}

const EXTREMES: [string, ScenarioLevers][] = [
  ["all zero", { salesGrowth: 0, marginChange: 0, opexChange: 0 }],
  ["lower bounds", { salesGrowth: -0.5, marginChange: -0.2, opexChange: -0.5 }],
  ["upper bounds", { salesGrowth: 1, marginChange: 0.2, opexChange: 1 }],
  ["collapse", { salesGrowth: -0.5, marginChange: -0.2, opexChange: 1 }],
  ["boom", { salesGrowth: 1, marginChange: 0.2, opexChange: -0.5 }],
  ["negative sales, flat costs", { salesGrowth: -0.1, marginChange: 0, opexChange: 0 }],
  ["cost cut only", { salesGrowth: 0, marginChange: 0, opexChange: -0.1 }],
];

describe("QA 1 · every scenario reconciles revenue → gross profit → EBITDA", () => {
  const vm = buildScenarioView(base, SCENARIO_PRESETS);

  it.each(SCENARIO_IDS)("%s case: full year matches the independent calculation", (id) => {
    const s = vm.scenarios.find((x) => x.id === id);
    const exp = independent(SCENARIO_PRESETS[id]);
    close(s?.metrics.revenue.actual ?? null, exp.revenue);
    close(s?.metrics.grossProfit.actual ?? null, exp.grossProfit);
    close(s?.metrics.opex.actual ?? null, exp.opex);
    close(s?.metrics.ebitda.actual ?? null, exp.ebitda);
    close(s?.metrics.ebitda.actual ?? null, (s?.metrics.grossProfit.actual ?? NaN) - (s?.metrics.opex.actual ?? NaN));
    close(s?.metrics.grossMargin.actual ?? null, exp.grossProfit / exp.revenue, 1e-12);
    close(s?.metrics.ebitdaMargin.actual ?? null, exp.ebitda / exp.revenue, 1e-12);
    close(s?.ebitdaFormula ?? null, exp.ebitda);
  });

  it.each(SCENARIO_IDS)("%s case: every month reconciles and months add up to the year", (id) => {
    const months = forecastYear(base.months, leversToAssumptions(SCENARIO_PRESETS[id]));
    let ebitdaYear = 0;
    months.forEach((m, i) => {
      const rev = CATEGORY_IDS.reduce((s, c) => s + (m.categories[c].revenue ?? NaN), 0);
      const cogs = CATEGORY_IDS.reduce((s, c) => s + (m.categories[c].cogs ?? NaN), 0);
      const opex = OPEX_ACCOUNT_IDS.reduce((s, x) => s + (m.opex[x] ?? NaN), 0);
      const b = base.months[i];
      const rev0 = CATEGORY_IDS.reduce((s, c) => s + (b.categories[c].revenue ?? NaN), 0);
      close(rev, rev0 * (1 + SCENARIO_PRESETS[id].salesGrowth));
      close(vm.monthly[i][id], rev - cogs - opex);
      ebitdaYear += rev - cogs - opex;
    });
    close(ebitdaYear, vm.scenarios.find((x) => x.id === id)?.metrics.ebitda.actual ?? null);
  });

  it("comparison table, bars and cards show the same numbers", () => {
    for (const row of vm.comparison)
      for (const id of SCENARIO_IDS)
        expect(row.values[id]).toBe(vm.scenarios.find((s) => s.id === id)?.metrics[row.key].actual);
    for (const bar of vm.ebitdaBars.filter((b) => b.id !== "baseYear"))
      expect(bar.ebitda).toBe(vm.comparison.find((r) => r.key === "ebitda")?.values[bar.id as "worst"]);
    close(vm.ebitdaBars[0].ebitda, GP0 - OPEX0);
  });
});

describe("QA 2 · sensitivities match independent formulas", () => {
  it.each(SCENARIO_IDS)("%s levers: closed form and finite differences on the engine agree", (id) => {
    const l = SCENARIO_PRESETS[id];
    const s = sensitivity(TOTALS, l);
    // Independent analytical derivatives of EBITDA = (1+s)(GP0 + m·Rev0) − (1+o)·Opex0
    close(s.sales, 0.01 * (GP0 + l.marginChange * REV0));
    close(s.margin, 0.01 * REV0 * (1 + l.salesGrowth));
    close(s.opex, -0.01 * OPEX0);
    // Finite differences on the full monthly engine
    const e = (x: ScenarioLevers) => buildScenarioView(base, all(x)).scenarios[0].metrics.ebitda.actual ?? NaN;
    const e0 = e(l);
    close(s.sales, e({ ...l, salesGrowth: l.salesGrowth + 0.01 }) - e0, 1e-3);
    close(s.margin, e({ ...l, marginChange: l.marginChange + 0.01 }) - e0, 1e-3);
    close(s.opex, e({ ...l, opexChange: l.opexChange + 0.01 }) - e0, 1e-3);
  });

  it("sensitivities are step changes vs FY2025 (percentage points of growth), not % of the scenario", () => {
    const l = SCENARIO_PRESETS.base;
    const s = sensitivity(TOTALS, l);
    // +1 pp sales growth = +1 % of FY2025 revenue, not +1 % of base-case revenue
    expect(Math.abs((s.sales ?? 0) - 0.01 * (1 + l.salesGrowth) * GP0)).toBeGreaterThan(50_000);
    // +1 pp opex change = +1 % of FY2025 opex
    close(s.opex, -0.01 * OPEX0);
  });

  it("is linear: sales and opex sensitivity do not depend on their own lever", () => {
    const a = sensitivity(TOTALS, { salesGrowth: -0.3, marginChange: 0.01, opexChange: 0.5 });
    const b = sensitivity(TOTALS, { salesGrowth: 0.6, marginChange: 0.01, opexChange: -0.2 });
    close(a.sales, b.sales);
    close(a.opex, b.opex);
  });
});

describe("QA 3 · zero, negative and extreme inputs", () => {
  it.each(EXTREMES)("%s: engine = closed form = independent, no NaN/Infinity", (_, l) => {
    const s = buildScenarioView(base, all(l)).scenarios[0];
    const exp = independent(l);
    close(s.metrics.ebitda.actual, exp.ebitda);
    close(s.ebitdaFormula, exp.ebitda);
    close(s.metrics.revenue.actual, exp.revenue);
    for (const c of Object.values(s.metrics)) {
      if (c.actual !== null) expect(Number.isFinite(c.actual)).toBe(true);
      if (c.percent !== null) expect(Number.isFinite(c.percent)).toBe(true);
    }
  });

  it("all-zero levers reproduce FY2025 exactly", () => {
    const s = buildScenarioView(base, all(EXTREMES[0][1])).scenarios[0];
    close(s.metrics.ebitda.actual, GP0 - OPEX0);
    expect(s.metrics.ebitda.status).toBe("neutral");
  });

  it("deep loss scenario: negative EBITDA and margins are reported, not hidden", () => {
    const s = buildScenarioView(base, all({ salesGrowth: -0.5, marginChange: -0.2, opexChange: 1 })).scenarios[0];
    expect(s.metrics.ebitda.actual ?? 0).toBeLessThan(0);
    expect(s.metrics.ebitdaMargin.actual ?? 0).toBeLessThan(0);
    expect(s.metrics.ebitda.status).toBe("unfavorable");
  });

  it("gross margin stays between 0 % and 100 % in every month at the margin bounds", () => {
    for (const m of [-0.2, 0.2]) {
      const months = forecastYear(base.months, leversToAssumptions({ salesGrowth: 0, marginChange: m, opexChange: 0 }));
      for (const month of months)
        for (const c of CATEGORY_IDS) {
          const f = month.categories[c];
          const gm = ((f.revenue ?? 0) - (f.cogs ?? 0)) / (f.revenue ?? 1);
          expect(gm).toBeGreaterThan(0);
          expect(gm).toBeLessThan(1);
        }
    }
  });

  it("out-of-range URL values are clamped to the same bounds as the inputs", () => {
    const s = parseScenarios({ worst: "-80,-35,250" });
    expect(s.worst).toEqual({ salesGrowth: -0.5, marginChange: -0.2, opexChange: 1 });
  });

  it("ordering warning fires only when EBITDA is out of order", () => {
    expect(buildScenarioView(base, SCENARIO_PRESETS).orderingWarning).toBe(false);
    expect(buildScenarioView(base, all(SCENARIO_PRESETS.base)).orderingWarning).toBe(false); // ties are fine
    expect(buildScenarioView(base, { ...SCENARIO_PRESETS, best: SCENARIO_PRESETS.worst }).orderingWarning).toBe(true);
  });
});

describe("QA 4 · scenario URLs reproduce all inputs", () => {
  const sets: [string, ScenarioSet][] = [
    ["presets", SCENARIO_PRESETS],
    ["bounds", { worst: { salesGrowth: -0.5, marginChange: -0.2, opexChange: -0.5 }, base: { salesGrowth: 0, marginChange: 0, opexChange: 0 }, best: { salesGrowth: 1, marginChange: 0.2, opexChange: 1 } }],
    ["fine steps", { worst: { salesGrowth: -0.0333, marginChange: -0.0025, opexChange: 0.0001 }, base: { salesGrowth: 0.0175, marginChange: 0.0075, opexChange: 0.0225 }, best: { salesGrowth: 0.0999, marginChange: 0.0125, opexChange: -0.0175 } }],
  ];
  it.each(sets)("%s: query → parse gives identical levers and identical results", (_, set) => {
    const query = scenariosToQuery(set);
    const parsed = parseScenarios(Object.fromEntries(new URLSearchParams(query)));
    expect(parsed).toEqual(set);
    const a = buildScenarioView(base, set);
    const b = buildScenarioView(base, parsed);
    for (const id of SCENARIO_IDS) expect(b.comparison.find((r) => r.key === "ebitda")?.values[id]).toBe(a.comparison.find((r) => r.key === "ebitda")?.values[id]);
  });

  it("accepts percent-encoded commas and a leading + sign", () => {
    const parsed = parseScenarios(Object.fromEntries(new URLSearchParams("best=%2B8%2C1%2C2")));
    expect(parsed.best).toEqual(SCENARIO_PRESETS.best);
  });

  it("missing scenarios fall back to presets independently", () => {
    const parsed = parseScenarios({ base: "5,0,3" });
    expect(parsed.worst).toEqual(SCENARIO_PRESETS.worst);
    expect(parsed.best).toEqual(SCENARIO_PRESETS.best);
    expect(parsed.base.salesGrowth).toBe(0.05);
  });
});

describe("QA 5 · Forecast base case vs Scenario base case (documented difference)", () => {
  const forecast = buildForecastView(base, DEFAULT_ASSUMPTIONS);
  const scenario = buildScenarioView(base, SCENARIO_PRESETS).scenarios.find((s) => s.id === "base");
  const kpi = (k: string) => forecast.kpis.find((x) => x.key === k)?.comparison.actual ?? NaN;

  it("the gap in EBITDA is exactly the gap in gross profit minus the gap in opex", () => {
    const gap = kpi("ebitda") - (scenario?.metrics.ebitda.actual ?? NaN);
    const gpGap = kpi("grossProfit") - (scenario?.metrics.grossProfit.actual ?? NaN);
    const opexGap = kpi("opex") - (scenario?.metrics.opex.actual ?? NaN);
    close(gap, gpGap - opexGap);
    expect(gap).toBeGreaterThan(0); // forecast defaults are slightly more optimistic
  });

  it("forecast revenue growth is the category-weighted (1 + unit growth) × (1 + price change)", () => {
    const expected = base.months.reduce(
      (s, m) =>
        s +
        CATEGORY_IDS.reduce((t, c) => {
          const a = DEFAULT_ASSUMPTIONS.categories[c];
          return t + (m.categories[c].revenue ?? NaN) * (1 + a.unitGrowth) * (1 + a.priceChange);
        }, 0),
      0,
    );
    close(kpi("revenue"), expected);
    expect(kpi("revenue") / REV0 - 1).toBeCloseTo(0.04285, 4);
  });

  it("forecast opex growth is the cost-weighted average of the per-account rates", () => {
    const expected = OPEX_ACCOUNT_IDS.reduce(
      (s, id) => s + base.months.reduce((t, m) => t + (m.opex[id] ?? NaN), 0) * (1 + DEFAULT_ASSUMPTIONS.opex[id]),
      0,
    );
    close(kpi("opex"), expected);
    expect(kpi("opex") / OPEX0 - 1).toBeCloseTo(0.03162, 4);
  });
});

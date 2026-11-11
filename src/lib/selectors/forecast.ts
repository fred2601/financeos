import { getAccount } from "@/lib/data/chart-of-accounts";
import { CATEGORY_IDS, CATEGORY_LABELS, type CategoryId, type Dataset } from "@/lib/data/schema";
import { pnlInputs, sumAmount } from "@/lib/finance/aggregate";
import {
  ASSUMPTION_BOUNDS,
  clamp,
  DEFAULT_ASSUMPTIONS,
  forecastYear,
  OPEX_ACCOUNT_IDS,
  type ForecastAssumptions,
  type ForecastBaseMonth,
  type MonthForecast,
  type OpexAccountId,
} from "@/lib/finance/forecast";
import { computeMetrics, type PnlMetrics } from "@/lib/finance/metrics";
import { parsePeriod, periodShortLabel, toPeriod } from "@/lib/finance/periods";
import { sumStrict, type Maybe } from "@/lib/finance/safe-math";
import { compareMetric, METRIC_PROFILE, percentVariance, type Comparison, type MetricKind } from "@/lib/finance/variance";

/**
 * Forecast page: base-year extraction (server), URL ⇄ assumptions, and the view-model.
 * buildForecastView is pure and cheap, so the page recalculates it live in the browser
 * as assumptions are edited.
 */

export interface ForecastBase {
  company: string;
  baseYear: number;
  forecastYear: number;
  months: ForecastBaseMonth[];
}

/** Base year = last full fiscal year in the dataset. */
export function getForecastBase(dataset: Dataset): ForecastBase {
  const { records, meta } = dataset;
  const baseYear = parsePeriod(meta.lastPeriod).year;
  const months: ForecastBaseMonth[] = Array.from({ length: 12 }, (_, i) => {
    const period = toPeriod(baseYear, i + 1);
    const categories = {} as ForecastBaseMonth["categories"];
    for (const c of CATEGORY_IDS) {
      const p = pnlInputs(records, { scenario: "actual", periods: [period], category: c });
      categories[c] = { units: p.units, revenue: p.revenue, cogs: p.cogs };
    }
    const opex = {} as ForecastBaseMonth["opex"];
    for (const id of OPEX_ACCOUNT_IDS) {
      opex[id] = sumAmount(records, { scenario: "actual", periods: [period], accountIds: [id] });
    }
    return { month: i + 1, categories, opex };
  });
  return { company: meta.company, baseYear, forecastYear: baseYear + 1, months };
}

// ---------------------------------------------------------------------------
// URL ⇄ assumptions. Values in the URL are in % / pp for readability:
// ?units=2,2,3&price=2,2,2&margin=0,0,0&opex=3.5,2,3,3,5,2
// (category order: home-living, fashion, outdoor-sport; opex in chart-of-accounts order)
// ---------------------------------------------------------------------------

function parseList(input: unknown, length: number): (number | null)[] {
  const raw = typeof input === "string" ? input.split(",") : [];
  return Array.from({ length }, (_, i) => {
    const s = raw[i];
    if (s === undefined || s.trim() === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n / 100 : null;
  });
}

export function parseAssumptions(params: Record<string, unknown>): ForecastAssumptions {
  const units = parseList(params.units, CATEGORY_IDS.length);
  const price = parseList(params.price, CATEGORY_IDS.length);
  const margin = parseList(params.margin, CATEGORY_IDS.length);
  const opexList = parseList(params.opex, OPEX_ACCOUNT_IDS.length);
  const d = DEFAULT_ASSUMPTIONS;

  const categories = {} as ForecastAssumptions["categories"];
  CATEGORY_IDS.forEach((c, i) => {
    categories[c] = {
      unitGrowth: clamp(units[i] ?? d.categories[c].unitGrowth, ASSUMPTION_BOUNDS.unitGrowth),
      priceChange: clamp(price[i] ?? d.categories[c].priceChange, ASSUMPTION_BOUNDS.priceChange),
      marginChange: clamp(margin[i] ?? d.categories[c].marginChange, ASSUMPTION_BOUNDS.marginChange),
    };
  });
  const opex = {} as ForecastAssumptions["opex"];
  OPEX_ACCOUNT_IDS.forEach((id, i) => {
    opex[id] = clamp(opexList[i] ?? d.opex[id], ASSUMPTION_BOUNDS.opex);
  });
  return { categories, opex };
}

/** Rounds to 0,01 % so URLs stay short and floating-point noise never leaks into them. */
const pct = (v: number) => String(Math.round(v * 10_000) / 100);

export function assumptionsToSearchParams(a: ForecastAssumptions): URLSearchParams {
  return new URLSearchParams({
    units: CATEGORY_IDS.map((c) => pct(a.categories[c].unitGrowth)).join(","),
    price: CATEGORY_IDS.map((c) => pct(a.categories[c].priceChange)).join(","),
    margin: CATEGORY_IDS.map((c) => pct(a.categories[c].marginChange)).join(","),
    opex: OPEX_ACCOUNT_IDS.map((id) => pct(a.opex[id])).join(","),
  });
}

export function isDefaultAssumptions(a: ForecastAssumptions): boolean {
  return assumptionsToSearchParams(a).toString() === assumptionsToSearchParams(DEFAULT_ASSUMPTIONS).toString();
}

// ---------------------------------------------------------------------------
// View-model
// ---------------------------------------------------------------------------

export interface ForecastKpi {
  key: "revenue" | "grossProfit" | "grossMargin" | "opex" | "ebitda" | "ebitdaMargin";
  label: string;
  kind: MetricKind;
  /** actual = forecast year, reference = base year */
  comparison: Comparison;
}

export interface ForecastChartPoint {
  month: string;
  revenueBase: Maybe;
  revenueForecast: Maybe;
  ebitdaBase: Maybe;
  ebitdaForecast: Maybe;
}

export interface CategoryFormula {
  id: CategoryId;
  label: string;
  unitsBase: Maybe;
  unitGrowth: number;
  unitsForecast: Maybe;
  aspBase: Maybe;
  priceChange: number;
  aspForecast: Maybe;
  revenueBase: Maybe;
  revenueForecast: Maybe;
  /** Forecast vs base year, fraction. */
  revenueChange: Maybe;
  grossMarginBase: Maybe;
  marginChange: number;
  grossMarginForecast: Maybe;
  grossProfitBase: Maybe;
  grossProfitForecast: Maybe;
}

export interface OpexFormula {
  id: OpexAccountId;
  label: string;
  base: Maybe;
  growth: number;
  forecast: Maybe;
}

export interface MonthRow {
  label: string;
  revenue: Maybe;
  grossProfit: Maybe;
  grossMargin: Maybe;
  opex: Maybe;
  ebitda: Maybe;
  ebitdaMargin: Maybe;
}

export interface ForecastViewModel {
  baseLabel: string;
  forecastLabel: string;
  kpis: ForecastKpi[];
  chart: ForecastChartPoint[];
  categories: CategoryFormula[];
  opex: OpexFormula[];
  grossProfit: { base: Maybe; forecast: Maybe };
  opexTotal: { base: Maybe; forecast: Maybe };
  ebitda: { base: Maybe; forecast: Maybe };
  months: MonthRow[];
}

type Sums = { units: Maybe; revenue: Maybe; cogs: Maybe };

function sumCategory(rows: readonly { categories: Record<CategoryId, Sums> }[], c: CategoryId): Sums {
  return {
    units: sumStrict(rows.map((r) => r.categories[c].units)),
    revenue: sumStrict(rows.map((r) => r.categories[c].revenue)),
    cogs: sumStrict(rows.map((r) => r.categories[c].cogs)),
  };
}

function monthMetrics(m: { categories: Record<CategoryId, Sums>; opex: Record<OpexAccountId, Maybe> }): PnlMetrics {
  return computeMetrics({
    units: sumStrict(CATEGORY_IDS.map((c) => m.categories[c].units)),
    revenue: sumStrict(CATEGORY_IDS.map((c) => m.categories[c].revenue)),
    cogs: sumStrict(CATEGORY_IDS.map((c) => m.categories[c].cogs)),
    opex: sumStrict(OPEX_ACCOUNT_IDS.map((id) => m.opex[id])),
    da: null,
  });
}

function yearMetrics(rows: readonly { categories: Record<CategoryId, Sums>; opex: Record<OpexAccountId, Maybe> }[]): PnlMetrics {
  return computeMetrics({
    units: sumStrict(CATEGORY_IDS.map((c) => sumCategory(rows, c).units)),
    revenue: sumStrict(CATEGORY_IDS.map((c) => sumCategory(rows, c).revenue)),
    cogs: sumStrict(CATEGORY_IDS.map((c) => sumCategory(rows, c).cogs)),
    opex: sumStrict(OPEX_ACCOUNT_IDS.map((id) => sumStrict(rows.map((r) => r.opex[id])))),
    da: null,
  });
}

const KPI_DEFS: { key: ForecastKpi["key"]; label: string }[] = [
  { key: "revenue", label: "Revenue" },
  { key: "grossProfit", label: "Gross profit" },
  { key: "grossMargin", label: "Gross margin" },
  { key: "opex", label: "Operating expenses" },
  { key: "ebitda", label: "EBITDA" },
  { key: "ebitdaMargin", label: "EBITDA margin" },
];

export function buildForecastView(base: ForecastBase, assumptions: ForecastAssumptions): ForecastViewModel {
  const forecast: MonthForecast[] = forecastYear(base.months, assumptions);
  const baseYear = yearMetrics(base.months);
  const fcYear = yearMetrics(forecast);

  // Note: "favorable" here means better than the base year, not better than budget.
  const kpis: ForecastKpi[] = KPI_DEFS.map(({ key, label }) => ({
    key,
    label,
    kind: METRIC_PROFILE[key].kind,
    comparison: compareMetric(key, fcYear, baseYear),
  }));

  const chart: ForecastChartPoint[] = base.months.map((m, i) => {
    const b = monthMetrics(m);
    const f = monthMetrics(forecast[i]);
    return {
      month: periodShortLabel(toPeriod(base.forecastYear, m.month)).slice(0, 3),
      revenueBase: b.revenue,
      revenueForecast: f.revenue,
      ebitdaBase: b.ebitda,
      ebitdaForecast: f.ebitda,
    };
  });

  const categories: CategoryFormula[] = CATEGORY_IDS.map((c) => {
    const a = assumptions.categories[c];
    const b = computeMetrics({ ...sumCategory(base.months, c), opex: null, da: null });
    const f = computeMetrics({ ...sumCategory(forecast, c), opex: null, da: null });
    return {
      id: c,
      label: CATEGORY_LABELS[c],
      unitsBase: b.units,
      unitGrowth: a.unitGrowth,
      unitsForecast: f.units,
      aspBase: b.averageSellingPrice,
      priceChange: a.priceChange,
      aspForecast: f.averageSellingPrice,
      revenueBase: b.revenue,
      revenueForecast: f.revenue,
      revenueChange: percentVariance(f.revenue, b.revenue),
      grossMarginBase: b.grossMargin,
      marginChange: a.marginChange,
      grossMarginForecast: f.grossMargin,
      grossProfitBase: b.grossProfit,
      grossProfitForecast: f.grossProfit,
    };
  });

  const opex: OpexFormula[] = OPEX_ACCOUNT_IDS.map((id) => ({
    id,
    label: getAccount(id)?.name ?? id,
    base: sumStrict(base.months.map((m) => m.opex[id])),
    growth: assumptions.opex[id],
    forecast: sumStrict(forecast.map((m) => m.opex[id])),
  }));

  const months: MonthRow[] = forecast.map((m) => {
    const f = monthMetrics(m);
    return {
      label: periodShortLabel(toPeriod(base.forecastYear, m.month)),
      revenue: f.revenue,
      grossProfit: f.grossProfit,
      grossMargin: f.grossMargin,
      opex: f.opex,
      ebitda: f.ebitda,
      ebitdaMargin: f.ebitdaMargin,
    };
  });

  return {
    baseLabel: `FY${base.baseYear} actual`,
    forecastLabel: `FY${base.forecastYear} forecast`,
    kpis,
    chart,
    categories,
    opex,
    grossProfit: { base: baseYear.grossProfit, forecast: fcYear.grossProfit },
    opexTotal: { base: baseYear.opex, forecast: fcYear.opex },
    ebitda: { base: baseYear.ebitda, forecast: fcYear.ebitda },
    months,
  };
}

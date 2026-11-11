import type { Dataset, Period } from "@/lib/data/schema";
import { CATEGORY_IDS, CATEGORY_LABELS, type CategoryId } from "@/lib/data/schema";
import { pnlInputs } from "@/lib/finance/aggregate";
import { computeMetrics, margin, type PnlMetrics } from "@/lib/finance/metrics";
import {
  addMonths,
  isPeriod,
  periodLabel,
  periodRange,
  periodShortLabel,
  previousPeriod,
  ytdPeriods,
} from "@/lib/finance/periods";
import { safeDivide, type Maybe } from "@/lib/finance/safe-math";
import { compare, compareMetric, METRIC_PROFILE, type Comparison, type MetricKind } from "@/lib/finance/variance";

/**
 * Builds everything the executive dashboard displays. All calculations happen here
 * (via lib/finance); the components only render the resulting plain data.
 */

export type DashboardView = "month" | "ytd";

export type KpiKey = "revenue" | "grossProfit" | "grossMargin" | "ebitda" | "ebitdaMargin";

export interface KpiViewModel {
  key: KpiKey;
  label: string;
  kind: MetricKind;
  actual: Maybe;
  budget: Maybe;
  vsBudget: Comparison;
  vsPrior: Comparison;
  priorLabel: string;
  /** Monthly actuals, last 12 months up to the selected period. */
  sparkline: { period: Period; value: Maybe }[];
}

export interface TrendPoint {
  period: Period;
  label: string;
  selected: boolean;
  inRange: boolean;
  revenueActual: Maybe;
  revenueBudget: Maybe;
  ebitdaActual: Maybe;
  ebitdaBudget: Maybe;
  grossMarginActual: Maybe;
  grossMarginBudget: Maybe;
  ebitdaMarginActual: Maybe;
  ebitdaMarginBudget: Maybe;
}

export interface PnlRow {
  key: keyof PnlMetrics;
  label: string;
  kind: MetricKind;
  comparison: Comparison;
  emphasis?: boolean;
  memo?: boolean;
}

export interface CategoryRow {
  id: CategoryId | "total";
  label: string;
  revenue: Comparison;
  revenueShare: Maybe;
  grossMargin: Comparison;
  averageSellingPrice: Comparison;
}

export interface DashboardViewModel {
  company: string;
  fictional: boolean;
  period: Period;
  periodLabel: string;
  view: DashboardView;
  rangeLabel: string;
  priorLabel: string;
  availablePeriods: { value: Period; label: string }[];
  kpis: KpiViewModel[];
  trend: TrendPoint[];
  pnl: PnlRow[];
  categories: CategoryRow[];
}

const KPI_DEFS: { key: KpiKey; label: string }[] = [
  { key: "revenue", label: "Revenue" },
  { key: "grossProfit", label: "Gross profit" },
  { key: "grossMargin", label: "Gross margin" },
  { key: "ebitda", label: "EBITDA" },
  { key: "ebitdaMargin", label: "EBITDA margin" },
];

const PNL_DEFS: Omit<PnlRow, "comparison" | "kind">[] = [
  { key: "revenue", label: "Revenue" },
  { key: "cogs", label: "Cost of goods sold" },
  { key: "grossProfit", label: "Gross profit", emphasis: true },
  { key: "grossMargin", label: "Gross margin" },
  { key: "opex", label: "Operating expenses" },
  { key: "ebitda", label: "EBITDA", emphasis: true },
  { key: "ebitdaMargin", label: "EBITDA margin" },
  { key: "da", label: "D&A (memo, not in EBITDA)", memo: true },
];

export function resolvePeriod(dataset: Dataset, input: unknown): Period {
  const { firstPeriod, lastPeriod } = dataset.meta;
  if (isPeriod(input) && input >= firstPeriod && input <= lastPeriod) return input;
  return lastPeriod;
}

export function resolveView(input: unknown): DashboardView {
  return input === "ytd" ? "ytd" : "month";
}

export function buildDashboard(
  dataset: Dataset,
  params: { period?: unknown; view?: unknown },
): DashboardViewModel {
  const { records, meta } = dataset;
  const period = resolvePeriod(dataset, params.period);
  const view = resolveView(params.view);

  // Periods in scope, and the comparison ("prior") periods:
  // month view → previous month (MoM); YTD view → same YTD last year (YoY).
  const scope = view === "month" ? [period] : ytdPeriods(period);
  const priorScope = view === "month" ? [previousPeriod(period)] : scope.map((p) => addMonths(p, -12));
  const priorLabel = view === "month" ? "vs prior month" : "vs prior-year YTD";

  const metricsFor = (scenario: "actual" | "budget", periods: Period[], category?: CategoryId) =>
    computeMetrics(pnlInputs(records, { scenario, periods, category }));

  const actual = metricsFor("actual", scope);
  const budget = metricsFor("budget", scope);
  const prior = metricsFor("actual", priorScope);

  const allPeriods = periodRange(meta.firstPeriod, meta.lastPeriod);
  const monthly = allPeriods.map((p) => ({
    period: p,
    actual: metricsFor("actual", [p]),
    budget: metricsFor("budget", [p]),
  }));

  const sparkPeriods = new Set(periodRange(addMonths(period, -11), period));

  const kpis: KpiViewModel[] = KPI_DEFS.map(({ key, label }) => ({
    key,
    label,
    kind: METRIC_PROFILE[key].kind,
    actual: actual[key],
    budget: budget[key],
    vsBudget: compareMetric(key, actual, budget),
    vsPrior: compareMetric(key, actual, prior),
    priorLabel,
    sparkline: monthly
      .filter((m) => sparkPeriods.has(m.period))
      .map((m) => ({ period: m.period, value: m.actual[key] })),
  }));

  const scopeSet = new Set(scope);
  const trend: TrendPoint[] = monthly.map((m) => ({
    period: m.period,
    label: periodShortLabel(m.period),
    selected: m.period === period,
    inRange: scopeSet.has(m.period),
    revenueActual: m.actual.revenue,
    revenueBudget: m.budget.revenue,
    ebitdaActual: m.actual.ebitda,
    ebitdaBudget: m.budget.ebitda,
    grossMarginActual: m.actual.grossMargin,
    grossMarginBudget: m.budget.grossMargin,
    ebitdaMarginActual: m.actual.ebitdaMargin,
    ebitdaMarginBudget: m.budget.ebitdaMargin,
  }));

  const pnl: PnlRow[] = PNL_DEFS.map((def) => ({
    ...def,
    kind: METRIC_PROFILE[def.key].kind,
    comparison: compareMetric(def.key, actual, budget),
  }));

  const categoryRow = (id: CategoryId | "total", label: string, a: PnlMetrics, b: PnlMetrics): CategoryRow => ({
    id,
    label,
    revenue: compareMetric("revenue", a, b),
    revenueShare: safeDivide(a.revenue, actual.revenue),
    grossMargin: compare(margin(a.grossProfit, a.revenue), margin(b.grossProfit, b.revenue), "higher-is-better", "ratio"),
    averageSellingPrice: compareMetric("averageSellingPrice", a, b),
  });

  const categories: CategoryRow[] = [
    ...CATEGORY_IDS.map((id) =>
      categoryRow(id, CATEGORY_LABELS[id], metricsFor("actual", scope, id), metricsFor("budget", scope, id)),
    ),
    categoryRow("total", "Total", actual, budget),
  ];

  return {
    company: meta.company,
    fictional: meta.fictional,
    period,
    periodLabel: periodLabel(period),
    view,
    rangeLabel:
      view === "month" ? periodLabel(period) : `YTD ${periodLabel(scope[0])} – ${periodLabel(period)}`,
    priorLabel,
    availablePeriods: [...allPeriods].reverse().map((p) => ({ value: p, label: periodLabel(p) })),
    kpis,
    trend,
    pnl,
    categories,
  };
}

import {
  clampLevers,
  leversToAssumptions,
  scenarioEbitda,
  SCENARIO_IDS,
  SCENARIO_LABELS,
  SCENARIO_PRESETS,
  sensitivity,
  type BaseTotals,
  type ScenarioId,
  type ScenarioLevers,
  type ScenarioSet,
  type Sensitivity,
} from "@/lib/finance/scenarios";
import { safeSubtract, type Maybe } from "@/lib/finance/safe-math";
import type { Comparison, MetricKind } from "@/lib/finance/variance";
import { buildForecastView, type ForecastBase, type ForecastKpi } from "./forecast";

/**
 * Scenario page view-model and URL handling.
 * URL format (values in % / pp): ?worst=-3,-1.5,4.5&base=4,0,3&best=8,1,2
 * (sales growth, gross margin change, opex change)
 */

function parseTriple(input: unknown): (number | null)[] {
  const raw = typeof input === "string" ? input.split(",") : [];
  return [0, 1, 2].map((i) => {
    const s = raw[i];
    if (s === undefined || s.trim() === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n / 100 : null;
  });
}

export function parseScenarios(params: Record<string, unknown>): ScenarioSet {
  const set = {} as ScenarioSet;
  for (const id of SCENARIO_IDS) {
    const [s, m, o] = parseTriple(params[id]);
    const preset = SCENARIO_PRESETS[id];
    set[id] = clampLevers({
      salesGrowth: s ?? preset.salesGrowth,
      marginChange: m ?? preset.marginChange,
      opexChange: o ?? preset.opexChange,
    });
  }
  return set;
}

const pct = (v: number) => String(Math.round(v * 10_000) / 100);

/** Query string with readable commas, e.g. "worst=-3,-1.5,4.5&base=4,0,3&best=8,1,2". */
export function scenariosToQuery(set: ScenarioSet): string {
  return SCENARIO_IDS.map((id) => {
    const l = set[id];
    return `${id}=${[l.salesGrowth, l.marginChange, l.opexChange].map(pct).join(",")}`;
  }).join("&");
}

export function isPresetScenarios(set: ScenarioSet): boolean {
  return scenariosToQuery(set) === scenariosToQuery(SCENARIO_PRESETS);
}

type MetricKey = ForecastKpi["key"];

export interface ScenarioResult {
  id: ScenarioId;
  label: string;
  levers: ScenarioLevers;
  /** Each metric vs the base year (actual = scenario, reference = base year). */
  metrics: Record<MetricKey, Comparison>;
  /** Closed-form EBITDA; equals metrics.ebitda.actual (tested). */
  ebitdaFormula: Maybe;
}

export interface ComparisonRow {
  key: MetricKey;
  label: string;
  kind: MetricKind;
  baseYear: Maybe;
  values: Record<ScenarioId, Maybe>;
  /** Best − worst: the range of outcomes. For ratios a difference in pp (fraction). */
  spread: Maybe;
}

export interface MonthlyEbitdaPoint {
  month: string;
  baseYear: Maybe;
  worst: Maybe;
  base: Maybe;
  best: Maybe;
}

export interface ScenarioViewModel {
  baseLabel: string;
  forecastLabel: string;
  baseTotals: BaseTotals;
  scenarios: ScenarioResult[];
  comparison: ComparisonRow[];
  ebitdaBars: { id: ScenarioId | "baseYear"; label: string; ebitda: Maybe }[];
  monthly: MonthlyEbitdaPoint[];
  sensitivity: Sensitivity;
  /** True when EBITDA is not ordered worst ≤ base ≤ best. */
  orderingWarning: boolean;
}

const METRICS: { key: MetricKey; label: string }[] = [
  { key: "revenue", label: "Revenue" },
  { key: "grossProfit", label: "Gross profit" },
  { key: "grossMargin", label: "Gross margin" },
  { key: "opex", label: "Operating expenses" },
  { key: "ebitda", label: "EBITDA" },
  { key: "ebitdaMargin", label: "EBITDA margin" },
];

export function buildScenarioView(base: ForecastBase, set: ScenarioSet): ScenarioViewModel {
  const views = Object.fromEntries(
    SCENARIO_IDS.map((id) => [id, buildForecastView(base, leversToAssumptions(set[id]))]),
  ) as Record<ScenarioId, ReturnType<typeof buildForecastView>>;

  const kpi = (id: ScenarioId, key: MetricKey) => {
    const k = views[id].kpis.find((x) => x.key === key);
    if (!k) throw new Error(`Missing KPI ${key}`);
    return k;
  };

  const anyView = views.base;
  const baseTotals: BaseTotals = {
    revenue: kpi("base", "revenue").comparison.reference,
    grossProfit: anyView.grossProfit.base,
    opex: anyView.opexTotal.base,
  };

  const scenarios: ScenarioResult[] = SCENARIO_IDS.map((id) => ({
    id,
    label: SCENARIO_LABELS[id],
    levers: set[id],
    metrics: Object.fromEntries(METRICS.map(({ key }) => [key, kpi(id, key).comparison])) as Record<MetricKey, Comparison>,
    ebitdaFormula: scenarioEbitda(baseTotals, set[id]),
  }));

  const comparison: ComparisonRow[] = METRICS.map(({ key, label }) => {
    const values = Object.fromEntries(SCENARIO_IDS.map((id) => [id, kpi(id, key).comparison.actual])) as Record<ScenarioId, Maybe>;
    return {
      key,
      label,
      kind: kpi("base", key).kind,
      baseYear: kpi("base", key).comparison.reference,
      values,
      spread: safeSubtract(values.best, values.worst),
    };
  });

  const ebitda = (id: ScenarioId) => kpi(id, "ebitda").comparison.actual;
  const ebitdaBars = [
    { id: "baseYear" as const, label: anyView.baseLabel.replace(" actual", " act."), ebitda: anyView.ebitda.base },
    ...SCENARIO_IDS.map((id) => ({ id, label: SCENARIO_LABELS[id], ebitda: ebitda(id) })),
  ];

  const monthly: MonthlyEbitdaPoint[] = anyView.chart.map((p, i) => ({
    month: p.month,
    baseYear: p.ebitdaBase,
    worst: views.worst.chart[i].ebitdaForecast,
    base: views.base.chart[i].ebitdaForecast,
    best: views.best.chart[i].ebitdaForecast,
  }));

  const [w, b, x] = [ebitda("worst"), ebitda("base"), ebitda("best")];
  const orderingWarning = w !== null && b !== null && x !== null && !(w <= b && b <= x);

  return {
    baseLabel: anyView.baseLabel,
    forecastLabel: anyView.forecastLabel,
    baseTotals,
    scenarios,
    comparison,
    ebitdaBars,
    monthly,
    sensitivity: sensitivity(baseTotals, set.base),
    orderingWarning,
  };
}

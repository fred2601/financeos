import { ACCOUNTS } from "@/lib/data/chart-of-accounts";
import {
  CATEGORY_IDS,
  CATEGORY_LABELS,
  CHANNEL_IDS,
  CHANNEL_LABELS,
  DEPARTMENT_IDS,
  DEPARTMENT_LABELS,
  type CategoryId,
  type ChannelId,
  type Dataset,
  type DepartmentId,
  type FinancialRecord,
  type Period,
  type Scenario,
} from "@/lib/data/schema";
import { pnlInputs, sumAmount } from "@/lib/finance/aggregate";
import { DEFAULT_MATERIALITY } from "@/lib/finance/materiality";
import { computeMetrics } from "@/lib/finance/metrics";
import { periodLabel, periodRange, ytdPeriods } from "@/lib/finance/periods";
import {
  grossProfitBridge,
  revenuePvm,
  segmentPriceVolume,
  type RevenuePvm,
  type Segment,
} from "@/lib/finance/price-volume";
import { safeSubtract, type Maybe } from "@/lib/finance/safe-math";
import { compare, compareMetric, type Comparison, type MetricKind } from "@/lib/finance/variance";
import { resolvePeriod, resolveView, type DashboardView } from "./dashboard";

/**
 * View-model for the Budget vs actual page. All variance maths is delegated to lib/finance.
 *
 * Filter scope (documented in the UI):
 *  - category filters revenue, COGS and gross profit (opex is not allocated to categories)
 *  - department filters operating expenses (revenue is not booked on departments)
 */

export interface VarianceFilters {
  period: Period;
  view: DashboardView;
  category: CategoryId | null;
  department: DepartmentId | null;
}

export interface SummaryItem {
  key: "revenue" | "grossProfit" | "grossMargin" | "opex" | "ebitda";
  label: string;
  scope: string;
  kind: MetricKind;
  comparison: Comparison;
}

export interface BridgeStep {
  key: string;
  label: string;
  value: number;
  /** [low, high] for a floating bar. */
  range: [number, number];
  type: "total" | "increase" | "decrease";
}

export interface AccountRow {
  key: string;
  label: string;
  level: "account" | "subtotal" | "total";
  kind: MetricKind;
  comparison: Comparison;
  /** Effect on EBITDA: + is good. Revenue variance counts +, cost overrun counts −. */
  ebitdaImpact: Maybe;
}

export interface DriverRow {
  key: string;
  label: string;
  detail: string;
  comparison: Comparison;
  ebitdaImpact: number;
}

export interface RevenueRow {
  key: string;
  category: string;
  channel: string;
  units: Comparison;
  asp: Comparison;
  revenue: Comparison;
  volumeEffect: Maybe;
  priceEffect: Maybe;
}

export interface CostLine {
  key: string;
  label: string;
  comparison: Comparison;
}

export interface CostGroup {
  department: DepartmentId;
  label: string;
  lines: CostLine[];
  subtotal: Comparison;
}

export interface VarianceViewModel {
  company: string;
  filters: VarianceFilters;
  rangeLabel: string;
  filtersActive: boolean;
  availablePeriods: { value: Period; label: string }[];
  categoryOptions: { value: CategoryId; label: string }[];
  departmentOptions: { value: DepartmentId; label: string }[];
  materiality: typeof DEFAULT_MATERIALITY;
  summary: SummaryItem[];
  bridge: BridgeStep[] | null;
  accounts: AccountRow[];
  drivers: DriverRow[];
  revenueRows: RevenueRow[];
  revenueTotal: RevenueRow;
  pvm: RevenuePvm | null;
  costGroups: CostGroup[];
  costTotal: Comparison;
}

function oneOf<T extends string>(values: readonly T[], input: unknown): T | null {
  return typeof input === "string" && (values as readonly string[]).includes(input) ? (input as T) : null;
}

export function resolveVarianceFilters(
  dataset: Dataset,
  params: { period?: unknown; view?: unknown; category?: unknown; department?: unknown },
): VarianceFilters {
  return {
    period: resolvePeriod(dataset, params.period),
    view: resolveView(params.view),
    category: oneOf(CATEGORY_IDS, params.category),
    department: oneOf(DEPARTMENT_IDS, params.department),
  };
}

const OPEX_ACCOUNTS = ACCOUNTS.filter((a) => a.type === "opex");

/** Positive = good for EBITDA. */
const impact = (c: Comparison, direction: "higher-is-better" | "lower-is-better"): Maybe =>
  c.absolute === null ? null : direction === "higher-is-better" ? c.absolute : -c.absolute;

function segments(
  records: readonly FinancialRecord[],
  scenario: Scenario,
  periods: Period[],
  category: CategoryId | null,
): Segment[] {
  const cats = category ? [category] : CATEGORY_IDS;
  return cats.flatMap((cat) =>
    CHANNEL_IDS.map((channel: ChannelId) => {
      const p = pnlInputs(records, { scenario, periods, category: cat, channel });
      return { key: `${cat}|${channel}`, units: p.units, revenue: p.revenue, cogs: p.cogs };
    }),
  );
}

export function buildVariance(
  dataset: Dataset,
  params: { period?: unknown; view?: unknown; category?: unknown; department?: unknown },
): VarianceViewModel {
  const { records, meta } = dataset;
  const filters = resolveVarianceFilters(dataset, params);
  const { period, view, category, department } = filters;
  const periods = view === "month" ? [period] : ytdPeriods(period);
  const filtersActive = category !== null || department !== null;

  // --- Sales side (category filter) and cost side (department filter) ---------------
  const sales = (scenario: Scenario) =>
    computeMetrics(pnlInputs(records, { scenario, periods, category: category ?? undefined }));
  const salesA = sales("actual");
  const salesB = sales("budget");
  const opexAmount = (scenario: Scenario, accountId?: string, dept: DepartmentId | null = department) =>
    sumAmount(records, {
      scenario,
      periods,
      accountTypes: ["opex"],
      accountIds: accountId ? [accountId] : undefined,
      department: dept ?? undefined,
    });
  const opexCmp = compare(opexAmount("actual"), opexAmount("budget"), "lower-is-better");

  // Company totals (unfiltered) for EBITDA and the bridge.
  const companyA = computeMetrics(pnlInputs(records, { scenario: "actual", periods }));
  const companyB = computeMetrics(pnlInputs(records, { scenario: "budget", periods }));

  const salesScope = category ? CATEGORY_LABELS[category] : "All categories";
  const costScope = department ? DEPARTMENT_LABELS[department] : "All departments";

  const summary: SummaryItem[] = [
    { key: "revenue", label: "Revenue", scope: salesScope, kind: "amount", comparison: compareMetric("revenue", salesA, salesB) },
    { key: "grossProfit", label: "Gross profit", scope: salesScope, kind: "amount", comparison: compareMetric("grossProfit", salesA, salesB) },
    { key: "grossMargin", label: "Gross margin", scope: salesScope, kind: "ratio", comparison: compareMetric("grossMargin", salesA, salesB) },
    { key: "opex", label: "Operating expenses", scope: costScope, kind: "amount", comparison: opexCmp },
    { key: "ebitda", label: "EBITDA", scope: "Company total", kind: "amount", comparison: compareMetric("ebitda", companyA, companyB) },
  ];

  // --- EBITDA bridge (company level) ---------------------------------------------------
  const gp = grossProfitBridge(segments(records, "actual", periods, null), segments(records, "budget", periods, null));
  let bridge: BridgeStep[] | null = null;
  const opexMoves = OPEX_ACCOUNTS.map((a) => ({
    key: a.id,
    label: a.id === "OPEX_OTHER" ? "Other opex" : a.name,
    // Budget − actual: spending less than budget raises EBITDA.
    value: safeSubtract(opexAmount("budget", a.id, null), opexAmount("actual", a.id, null)),
  }));
  const opexComplete = opexMoves.every((m) => m.value !== null);
  if (gp && opexComplete && companyA.ebitda !== null && companyB.ebitda !== null) {
    const moves: { key: string; label: string; value: number }[] = [
      { key: "volumeMix", label: "Volume & mix", value: gp.volumeMix },
      { key: "price", label: "Selling price", value: gp.price },
      { key: "unitCost", label: "Product cost", value: gp.unitCost },
      ...opexMoves.map((m) => ({ ...m, value: m.value ?? 0 })),
    ];
    let running = companyB.ebitda;
    bridge = [{ key: "budget", label: "Budget EBITDA", value: running, range: [Math.min(0, running), Math.max(0, running)], type: "total" }];
    for (const m of moves) {
      const next = running + m.value;
      bridge.push({
        key: m.key,
        label: m.label,
        value: m.value,
        range: [Math.min(running, next), Math.max(running, next)],
        type: m.value >= 0 ? "increase" : "decrease",
      });
      running = next;
    }
    bridge.push({
      key: "actual",
      label: "Actual EBITDA",
      value: companyA.ebitda,
      range: [Math.min(0, companyA.ebitda), Math.max(0, companyA.ebitda)],
      type: "total",
    });
  }

  // --- Account table -------------------------------------------------------------------
  const row = (key: string, label: string, level: AccountRow["level"], c: Comparison, dir: "higher-is-better" | "lower-is-better", kind: MetricKind = "amount"): AccountRow => ({
    key, label, level, kind, comparison: c, ebitdaImpact: kind === "ratio" ? null : impact(c, dir),
  });
  const accounts: AccountRow[] = [
    row("REV", "Revenue", "account", compareMetric("revenue", salesA, salesB), "higher-is-better"),
    row("COGS", "Cost of goods sold", "account", compareMetric("cogs", salesA, salesB), "lower-is-better"),
    row("GP", "Gross profit", "subtotal", compareMetric("grossProfit", salesA, salesB), "higher-is-better"),
    row("GM", "Gross margin", "account", compareMetric("grossMargin", salesA, salesB), "higher-is-better", "ratio"),
    ...OPEX_ACCOUNTS.map((a) =>
      row(a.id, a.name, "account", compare(opexAmount("actual", a.id), opexAmount("budget", a.id), "lower-is-better"), "lower-is-better"),
    ),
    row("OPEX", "Operating expenses", "subtotal", opexCmp, "lower-is-better"),
    ...(filtersActive ? [] : [row("EBITDA", "EBITDA", "total" as const, compareMetric("ebitda", companyA, companyB), "higher-is-better")]),
  ];

  // --- Largest variances (gross profit by segment, opex by department × account) ------
  // Picking only a department focuses the list on costs; picking only a category on sales.
  const showSalesDrivers = !(department && !category);
  const showCostDrivers = !(category && !department);
  const driverCandidates: DriverRow[] = [];
  for (const cat of !showSalesDrivers ? [] : category ? [category] : CATEGORY_IDS)
    for (const channel of CHANNEL_IDS) {
      const a = computeMetrics(pnlInputs(records, { scenario: "actual", periods, category: cat, channel }));
      const b = computeMetrics(pnlInputs(records, { scenario: "budget", periods, category: cat, channel }));
      const c = compareMetric("grossProfit", a, b);
      if (c.absolute !== null)
        driverCandidates.push({ key: `gp|${cat}|${channel}`, label: `Gross profit · ${CATEGORY_LABELS[cat]}`, detail: CHANNEL_LABELS[channel], comparison: c, ebitdaImpact: c.absolute });
    }
  for (const dept of !showCostDrivers ? [] : department ? [department] : DEPARTMENT_IDS)
    for (const a of OPEX_ACCOUNTS) {
      const c = compare(opexAmount("actual", a.id, dept), opexAmount("budget", a.id, dept), "lower-is-better");
      if (c.absolute !== null)
        driverCandidates.push({ key: `opex|${dept}|${a.id}`, label: a.name, detail: DEPARTMENT_LABELS[dept], comparison: c, ebitdaImpact: -c.absolute });
    }
  const drivers = driverCandidates
    .sort((x, y) => Math.abs(y.ebitdaImpact) - Math.abs(x.ebitdaImpact))
    .slice(0, 8);

  // --- Revenue analysis ----------------------------------------------------------------
  const segA = segments(records, "actual", periods, category);
  const segB = segments(records, "budget", periods, category);
  const revenueRows: RevenueRow[] = segA.map((a, i) => {
    const b = segB[i];
    const [cat, channel] = a.key.split("|") as [CategoryId, ChannelId];
    const pv = segmentPriceVolume(a, b);
    return {
      key: a.key,
      category: CATEGORY_LABELS[cat],
      channel: CHANNEL_LABELS[channel],
      units: compare(a.units, b.units, "higher-is-better", "driver"),
      asp: compare(safeAsp(a), safeAsp(b), "higher-is-better", "driver"),
      revenue: compare(a.revenue, b.revenue, "higher-is-better"),
      volumeEffect: pv.volume,
      priceEffect: pv.price,
    };
  });
  const pvm = revenuePvm(segA, segB);
  const revenueTotal: RevenueRow = {
    key: "total",
    category: "Total",
    channel: "",
    units: compareMetric("units", salesA, salesB),
    asp: compareMetric("averageSellingPrice", salesA, salesB),
    revenue: compareMetric("revenue", salesA, salesB),
    volumeEffect: pvm ? pvm.volume + pvm.mix : null,
    priceEffect: pvm ? pvm.price : null,
  };

  // --- Cost analysis -------------------------------------------------------------------
  const costGroups: CostGroup[] = (department ? [department] : DEPARTMENT_IDS)
    .map((dept) => {
      const lines = OPEX_ACCOUNTS.flatMap((a) => {
        const c = compare(opexAmount("actual", a.id, dept), opexAmount("budget", a.id, dept), "lower-is-better");
        return c.actual === null && c.reference === null ? [] : [{ key: `${dept}|${a.id}`, label: a.name, comparison: c }];
      });
      return {
        department: dept,
        label: DEPARTMENT_LABELS[dept],
        lines,
        subtotal: compare(opexAmount("actual", undefined, dept), opexAmount("budget", undefined, dept), "lower-is-better"),
      };
    })
    .filter((g) => g.lines.length > 0);

  return {
    company: meta.company,
    filters,
    rangeLabel: view === "month" ? periodLabel(period) : `YTD ${periodLabel(periods[0])} – ${periodLabel(period)}`,
    filtersActive,
    availablePeriods: [...periodRange(meta.firstPeriod, meta.lastPeriod)].reverse().map((p) => ({ value: p, label: periodLabel(p) })),
    categoryOptions: CATEGORY_IDS.map((value) => ({ value, label: CATEGORY_LABELS[value] })),
    departmentOptions: DEPARTMENT_IDS.map((value) => ({ value, label: DEPARTMENT_LABELS[value] })),
    materiality: DEFAULT_MATERIALITY,
    summary,
    bridge,
    accounts,
    drivers,
    revenueRows,
    revenueTotal,
    pvm,
    costGroups,
    costTotal: opexCmp,
  };
}

function safeAsp(s: Segment): Maybe {
  return computeMetrics({ revenue: s.revenue, units: s.units, cogs: s.cogs, opex: null, da: null }).averageSellingPrice;
}

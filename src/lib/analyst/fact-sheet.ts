import type { Dataset } from "@/lib/data/schema";
import type { Favorability } from "@/lib/finance/variance";
import type { Comparison, MetricKind } from "@/lib/finance/variance";
import { formatDkk, formatPercent, formatPp } from "@/lib/format";
import { buildDashboard } from "@/lib/selectors/dashboard";
import { buildVariance } from "@/lib/selectors/variance";
import { isMaterialAmount } from "@/lib/finance/materiality";

/**
 * The fact sheet: every figure the AI analyst is allowed to use, computed and formatted
 * by FinanceOS's tested finance engine. The model only ever refers to these by id
 * ({{F12}}); it never writes numbers itself. Only aggregated metrics are included —
 * no transaction-level records.
 */

export type FactStatus = "favorable" | "unfavorable" | "within threshold" | "not applicable";

export interface Fact {
  id: string;
  /** What the figure is, e.g. "Revenue, actual vs budget — variance". */
  label: string;
  /** Display value, formatted with the app's Danish conventions. */
  value: string;
  /** Favorability as decided by the app (account direction + materiality). */
  status: FactStatus;
  group: "context" | "kpi" | "driver" | "price-volume" | "category";
}

export interface FactSheet {
  company: string;
  fictional: boolean;
  period: string;
  view: "month" | "ytd";
  scopeLabel: string;
  facts: Fact[];
}

const statusOf = (s: Favorability, material = true): FactStatus =>
  !material ? "within threshold" : s === "favorable" ? "favorable" : s === "unfavorable" ? "unfavorable" : "within threshold";

function fmt(v: number | null, kind: MetricKind, signed = false) {
  return kind === "ratio" ? formatPercent(v, { signed }) : formatDkk(v, { signed });
}

export function buildFactSheet(dataset: Dataset, params: { period?: unknown; view?: unknown }): FactSheet {
  const dash = buildDashboard(dataset, params);
  const variance = buildVariance(dataset, { period: dash.period, view: dash.view });
  const facts: Fact[] = [];
  let n = 0;
  const add = (f: Omit<Fact, "id">) => {
    n += 1;
    facts.push({ id: `F${n}`, ...f });
  };

  add({ group: "context", label: "Period analysed", value: dash.rangeLabel, status: "not applicable" });
  add({
    group: "context",
    label: "Comparison period for 'prior' figures",
    value: dash.view === "month" ? "previous month" : "same period of the previous year",
    status: "not applicable",
  });

  // KPIs: actual, budget, variance vs budget, change vs prior
  for (const k of dash.kpis) {
    const b: Comparison = k.vsBudget;
    const p: Comparison = k.vsPrior;
    add({ group: "kpi", label: `${k.label} — actual`, value: fmt(k.actual, k.kind), status: "not applicable" });
    add({ group: "kpi", label: `${k.label} — budget`, value: fmt(k.budget, k.kind), status: "not applicable" });
    add({
      group: "kpi",
      label: `${k.label} — variance vs budget`,
      value:
        k.kind === "ratio"
          ? formatPp(b.absolute)
          : `${formatDkk(b.absolute, { signed: true })} (${formatPercent(b.percent, { signed: true })})`,
      status: statusOf(b.status),
    });
    add({
      group: "kpi",
      label: `${k.label} — change ${k.priorLabel.replace("vs ", "vs ")}`,
      value:
        k.kind === "ratio"
          ? formatPp(p.absolute)
          : `${formatDkk(p.absolute, { signed: true })} (${formatPercent(p.percent, { signed: true })})`,
      status: p.reference === null ? "not applicable" : statusOf(p.status),
    });
  }

  // Operating expenses vs budget (lower is better)
  const opex = variance.summary.find((s) => s.key === "opex")?.comparison;
  if (opex) {
    add({
      group: "kpi",
      label: "Operating expenses — variance vs budget",
      value: `${formatDkk(opex.absolute, { signed: true })} (${formatPercent(opex.percent, { signed: true })})`,
      status: statusOf(opex.status),
    });
  }

  // Largest variance drivers by EBITDA impact
  for (const d of variance.drivers.slice(0, 6)) {
    add({
      group: "driver",
      label: `EBITDA impact vs budget — ${d.label} (${d.detail})`,
      value: `${formatDkk(d.ebitdaImpact, { signed: true })} (line variance ${formatPercent(d.comparison.percent, { signed: true })})`,
      status: statusOf(d.comparison.status),
    });
  }

  // Revenue price / volume / mix
  if (variance.pvm) {
    const pv = variance.pvm;
    // Same materiality as everywhere else (no % exists for an effect, so the DKK test applies).
    const s = (v: number): FactStatus =>
      !isMaterialAmount(v, null) ? "within threshold" : v > 0 ? "favorable" : "unfavorable";
    add({ group: "price-volume", label: "Revenue variance from volume (units)", value: formatDkk(pv.volume, { signed: true }), status: s(pv.volume) });
    add({ group: "price-volume", label: "Revenue variance from mix (category/channel)", value: formatDkk(pv.mix, { signed: true }), status: s(pv.mix) });
    add({ group: "price-volume", label: "Revenue variance from selling price", value: formatDkk(pv.price, { signed: true }), status: s(pv.price) });
  }

  // Category revenue and gross margin vs budget
  for (const c of dash.categories.filter((x) => x.id !== "total")) {
    add({
      group: "category",
      label: `${c.label} — revenue vs budget`,
      value: `${formatDkk(c.revenue.absolute, { signed: true })} (${formatPercent(c.revenue.percent, { signed: true })})`,
      status: statusOf(c.revenue.status),
    });
    add({
      group: "category",
      label: `${c.label} — gross margin vs budget`,
      value: `${formatPercent(c.grossMargin.actual)} (${formatPp(c.grossMargin.absolute)})`,
      status: statusOf(c.grossMargin.status),
    });
  }

  return {
    company: dash.company,
    fictional: dash.fictional,
    period: dash.period,
    view: dash.view,
    scopeLabel: dash.rangeLabel,
    facts,
  };
}

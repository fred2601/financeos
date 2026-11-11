"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Link2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScenarioEbitdaChart, ScenarioMonthlyChart, SCENARIO_COLORS } from "@/components/charts/scenario-charts";
import { VarianceIndicator } from "@/components/dashboard/variance-indicator";
import { PercentInput } from "@/components/forecast/percent-input";
import {
  LEVER_BOUNDS,
  SCENARIO_IDS,
  SCENARIO_PRESETS,
  type ScenarioId,
  type ScenarioLevers,
  type ScenarioSet,
} from "@/lib/finance/scenarios";
import type { Maybe } from "@/lib/finance/safe-math";
import type { MetricKind } from "@/lib/finance/variance";
import type { ForecastBase } from "@/lib/selectors/forecast";
import { buildScenarioView, isPresetScenarios, scenariosToQuery, type ScenarioResult } from "@/lib/selectors/scenarios";
import { formatDkk, formatPercent, formatPp } from "@/lib/format";
import { cn } from "@/lib/utils";

const value = (v: Maybe, kind: MetricKind) => (kind === "ratio" ? formatPercent(v) : formatDkk(v));

/**
 * Worst / base / best scenarios with live EBITDA. Levers live in React state and are
 * mirrored to the URL without a server round-trip, so a scenario set can be shared.
 */
export function ScenarioWorkspace({ base, initial }: { base: ForecastBase; initial: ScenarioSet }) {
  const [set, setSet] = useState(initial);
  const [copied, setCopied] = useState(false);
  const vm = useMemo(() => buildScenarioView(base, set), [base, set]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const query = isPresetScenarios(set) ? "" : `?${scenariosToQuery(set)}`;
      window.history.replaceState(null, "", `${window.location.pathname}${query}`);
    }, 250);
    return () => window.clearTimeout(id);
  }, [set]);

  const setLever = (id: ScenarioId, key: keyof ScenarioLevers, v: number) =>
    setSet((s) => ({ ...s, [id]: { ...s[id], [key]: v } }));

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable; the address bar still holds the link.
    }
  };

  const t = vm.baseTotals;
  const b = set.base;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Each scenario changes three levers vs {vm.baseLabel}. EBITDA recalculates as you type.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setSet(SCENARIO_PRESETS)} disabled={isPresetScenarios(set)}>
            <RotateCcw /> Reset presets
          </Button>
          <Button variant="outline" size="sm" onClick={copyLink}>
            {copied ? <Check /> : <Link2 />} {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      </div>

      {vm.orderingWarning && (
        <div role="status" className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          EBITDA is not ordered worst ≤ base ≤ best. Check whether the scenario levers are set as intended.
        </div>
      )}

      <section aria-label="Scenarios" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {vm.scenarios.map((s) => (
          <ScenarioCard key={s.id} scenario={s} baseLabel={vm.baseLabel} onChange={(k, v) => setLever(s.id, k, v)} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Full-year EBITDA</CardTitle>
            <CardDescription>{vm.forecastLabel.replace(" forecast", "")} scenarios vs {vm.baseLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            <ScenarioEbitdaChart data={vm.ebitdaBars} />
          </CardContent>
        </Card>
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>Monthly EBITDA</CardTitle>
            <CardDescription className="flex flex-wrap gap-x-4">
              {(["baseYear", ...SCENARIO_IDS] as const).map((k) => (
                <span key={k} className="inline-flex items-center gap-1.5">
                  <span
                    className="inline-block w-4"
                    style={{ borderTop: `2px ${k === "baseYear" ? "dashed" : "solid"} ${SCENARIO_COLORS[k]}` }}
                  />
                  {k === "baseYear" ? vm.baseLabel : `${k[0].toUpperCase()}${k.slice(1)} case`}
                </span>
              ))}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScenarioMonthlyChart data={vm.monthly} baseLabel={vm.baseLabel} />
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 2xl:grid-cols-5">
        <Card className="2xl:col-span-3">
          <CardHeader>
            <CardTitle>Scenario comparison</CardTitle>
            <CardDescription>Full-year results · spread = best case − worst case</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead className="text-right">{vm.baseLabel}</TableHead>
                  <TableHead className="text-right">Worst</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">Best</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Spread</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vm.comparison.map((r) => (
                  <TableRow key={r.key} className={cn(r.key === "ebitda" && "bg-muted/40 font-semibold")}>
                    <TableCell className={cn(r.kind === "ratio" && "pl-6 text-muted-foreground")}>{r.label}</TableCell>
                    <TableCell className="num text-right text-muted-foreground">{value(r.baseYear, r.kind)}</TableCell>
                    {SCENARIO_IDS.map((id) => (
                      <TableCell key={id} className="num text-right">
                        {value(r.values[id], r.kind)}
                      </TableCell>
                    ))}
                    <TableCell className="num hidden text-right text-muted-foreground sm:table-cell">
                      {r.kind === "ratio" ? formatPp(r.spread) : formatDkk(r.spread)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="2xl:col-span-2">
          <CardHeader>
            <CardTitle>How EBITDA is calculated</CardTitle>
            <CardDescription>Full-year formula, shown for the base case</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <code className="num block rounded-md bg-muted px-3 py-2 font-mono text-xs leading-relaxed">
              EBITDA = (1 + sales growth) × (gross profit₀ + margin change × revenue₀) − (1 + opex change) × opex₀
            </code>
            <code className="num block rounded-md bg-muted px-3 py-2 font-mono text-xs leading-relaxed">
              = (1 {sign(b.salesGrowth)} {formatPercent(Math.abs(b.salesGrowth))}) × ({formatDkk(t.grossProfit)} {sign(b.marginChange)}{" "}
              {formatPp(Math.abs(b.marginChange)).replace("+", "")} × {formatDkk(t.revenue)}) − (1 {sign(b.opexChange)}{" "}
              {formatPercent(Math.abs(b.opexChange))}) × {formatDkk(t.opex)} ={" "}
              <strong>{formatDkk(vm.scenarios.find((s) => s.id === "base")?.ebitdaFormula ?? null)}</strong>
            </code>
            <div>
              <div className="mb-1.5 text-[13px] font-medium">Sensitivity (base case)</div>
              <dl className="num grid grid-cols-[1fr_auto] gap-y-1 text-sm">
                <dt className="text-muted-foreground">+1 % sales growth</dt>
                <dd className="text-right">{formatDkk(vm.sensitivity.sales, { signed: true })}</dd>
                <dt className="text-muted-foreground">+1 pp gross margin</dt>
                <dd className="text-right">{formatDkk(vm.sensitivity.margin, { signed: true })}</dd>
                <dt className="text-muted-foreground">+1 % operating expenses</dt>
                <dd className="text-right">{formatDkk(vm.sensitivity.opex, { signed: true })}</dd>
              </dl>
            </div>
            <p className="text-xs text-muted-foreground">
              ₀ = {vm.baseLabel}. Amounts in the formula are rounded for display.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

const sign = (v: number) => (v < 0 ? "−" : "+");

const ACCENT: Record<ScenarioId, string> = {
  worst: "border-t-unfavorable",
  base: "border-t-primary",
  best: "border-t-favorable",
};

function ScenarioCard({
  scenario: s,
  baseLabel,
  onChange,
}: {
  scenario: ScenarioResult;
  baseLabel: string;
  onChange: (key: keyof ScenarioLevers, value: number) => void;
}) {
  const e = s.metrics.ebitda;
  const rows: { key: keyof ScenarioResult["metrics"]; label: string; kind: MetricKind }[] = [
    { key: "revenue", label: "Revenue", kind: "amount" },
    { key: "grossProfit", label: "Gross profit", kind: "amount" },
    { key: "grossMargin", label: "Gross margin", kind: "ratio" },
    { key: "opex", label: "Operating expenses", kind: "amount" },
    { key: "ebitdaMargin", label: "EBITDA margin", kind: "ratio" },
  ];
  return (
    <Card className={cn("gap-0 border-t-4 p-0", ACCENT[s.id])}>
      <div className="flex flex-col gap-3 p-4">
        <h2 className="text-base font-semibold">{s.label}</h2>
        <div className="flex flex-col gap-2">
          <PercentInput label="Sales growth" value={s.levers.salesGrowth} onChange={(v) => onChange("salesGrowth", v)} {...LEVER_BOUNDS.salesGrowth} />
          <PercentInput
            label="Gross margin change"
            unit="pp"
            step={0.25}
            value={s.levers.marginChange}
            onChange={(v) => onChange("marginChange", v)}
            {...LEVER_BOUNDS.marginChange}
          />
          <PercentInput label="Opex change" value={s.levers.opexChange} onChange={(v) => onChange("opexChange", v)} {...LEVER_BOUNDS.opexChange} />
        </div>
      </div>
      <div className="border-t bg-muted/30 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="text-[13px] font-medium text-muted-foreground">EBITDA</div>
          <VarianceIndicator comparison={e} kind="amount" />
        </div>
        <div className="num mt-1 text-2xl font-semibold tracking-tight">{formatDkk(e.actual)}</div>
        <div className="num text-xs text-muted-foreground">
          {baseLabel}: {formatDkk(e.reference)} · {formatDkk(e.absolute, { signed: true })}
        </div>
        <dl className="num mt-3 grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-1.5 text-sm">
          {rows.map((r) => {
            const c = s.metrics[r.key];
            return (
              <div key={r.key} className="contents">
                <dt className="text-muted-foreground">{r.label}</dt>
                <dd className="text-right">{value(c.actual, r.kind)}</dd>
                <dd className="text-right">
                  <VarianceIndicator comparison={c} kind={r.kind} className="bg-transparent px-0" />
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </Card>
  );
}

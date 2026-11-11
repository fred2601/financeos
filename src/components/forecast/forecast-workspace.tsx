"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Link2, RotateCcw, Sigma } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ForecastChart } from "@/components/charts/forecast-chart";
import { VarianceIndicator } from "@/components/dashboard/variance-indicator";
import { ASSUMPTION_BOUNDS, DEFAULT_ASSUMPTIONS, type ForecastAssumptions, type OpexAccountId } from "@/lib/finance/forecast";
import { CATEGORY_IDS, CATEGORY_LABELS, type CategoryId } from "@/lib/data/schema";
import { getAccount } from "@/lib/data/chart-of-accounts";
import {
  assumptionsToSearchParams,
  buildForecastView,
  isDefaultAssumptions,
  type ForecastBase,
} from "@/lib/selectors/forecast";
import { OPEX_ACCOUNT_IDS } from "@/lib/finance/forecast";
import { formatDkk, formatPercent, formatPp } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CategoryForecastTable, MonthlyForecastTable, OpexForecastTable } from "./forecast-tables";
import { PercentInput } from "./percent-input";

/**
 * Interactive forecast. Assumptions live in React state for instant recalculation and are
 * mirrored to the URL (without a server round-trip), so a scenario can be shared as a link.
 */
export function ForecastWorkspace({ base, initial }: { base: ForecastBase; initial: ForecastAssumptions }) {
  const [assumptions, setAssumptions] = useState(initial);
  const [showFormulas, setShowFormulas] = useState(false);
  const [copied, setCopied] = useState(false);
  const vm = useMemo(() => buildForecastView(base, assumptions), [base, assumptions]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      // Commas are valid in a query string; un-escaping them keeps shared links readable.
      const params = assumptionsToSearchParams(assumptions).toString().replaceAll("%2C", ",");
      const query = isDefaultAssumptions(assumptions) ? "" : `?${params}`;
      window.history.replaceState(null, "", `${window.location.pathname}${query}`);
    }, 250);
    return () => window.clearTimeout(id);
  }, [assumptions]);

  const setCategory = (c: CategoryId, key: keyof ForecastAssumptions["categories"][CategoryId], value: number) =>
    setAssumptions((a) => ({ ...a, categories: { ...a.categories, [c]: { ...a.categories[c], [key]: value } } }));
  const setOpex = (id: OpexAccountId, value: number) => setAssumptions((a) => ({ ...a, opex: { ...a.opex, [id]: value } }));

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be unavailable (permissions, insecure context); the URL bar still has the link.
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_1fr]">
      {/* Assumptions */}
      <aside className="flex flex-col gap-4 xl:sticky xl:top-6 xl:self-start">
        <Card className="overflow-visible">
          <CardHeader>
            <CardTitle>Assumptions</CardTitle>
            <CardDescription>Change vs {vm.baseLabel}. Results update instantly.</CardDescription>
          </CardHeader>
          {/* On smaller screens the results sit below the inputs; keep the outcome in view while editing. */}
          <LiveSummary vm={vm} />
          <CardContent className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-1">
            {CATEGORY_IDS.map((c) => (
              <fieldset key={c} className="flex flex-col gap-2">
                <legend className="mb-1 text-[13px] font-semibold">{CATEGORY_LABELS[c]}</legend>
                <PercentInput
                  label="Unit growth"
                  value={assumptions.categories[c].unitGrowth}
                  onChange={(v) => setCategory(c, "unitGrowth", v)}
                  {...ASSUMPTION_BOUNDS.unitGrowth}
                />
                <PercentInput
                  label="Price change"
                  value={assumptions.categories[c].priceChange}
                  onChange={(v) => setCategory(c, "priceChange", v)}
                  {...ASSUMPTION_BOUNDS.priceChange}
                />
                <PercentInput
                  label="Gross margin change"
                  unit="pp"
                  step={0.25}
                  value={assumptions.categories[c].marginChange}
                  onChange={(v) => setCategory(c, "marginChange", v)}
                  {...ASSUMPTION_BOUNDS.marginChange}
                />
              </fieldset>
            ))}
            <fieldset className="grid grid-cols-1 gap-x-6 gap-y-2 border-t pt-4 md:col-span-2 md:grid-cols-2 xl:col-span-1 xl:grid-cols-1">
              <legend className="mb-1 text-[13px] font-semibold">Operating cost growth</legend>
              {OPEX_ACCOUNT_IDS.map((id) => (
                <PercentInput
                  key={id}
                  label={id === "OPEX_OTHER" ? "Other opex" : (getAccount(id)?.name ?? id)}
                  value={assumptions.opex[id]}
                  onChange={(v) => setOpex(id, v)}
                  {...ASSUMPTION_BOUNDS.opex}
                />
              ))}
            </fieldset>
            <div className="flex flex-wrap gap-2 border-t pt-4 md:col-span-2 xl:col-span-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAssumptions(DEFAULT_ASSUMPTIONS)}
                disabled={isDefaultAssumptions(assumptions)}
              >
                <RotateCcw /> Reset
              </Button>
              <Button variant="outline" size="sm" onClick={copyLink}>
                {copied ? <Check /> : <Link2 />} {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </aside>

      {/* Results */}
      <div className="flex min-w-0 flex-col gap-4">
        <section aria-label="Forecast KPIs" className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
          {vm.kpis.map((k) => {
            const ratio = k.kind === "ratio";
            const v = (x: number | null) => (ratio ? formatPercent(x) : formatDkk(x));
            return (
              <Card key={k.key} className="gap-0 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[13px] font-medium text-muted-foreground">{k.label}</h3>
                  <VarianceIndicator comparison={k.comparison} kind={k.kind} />
                </div>
                <div className="num mt-2 text-xl font-semibold tracking-tight">{v(k.comparison.actual)}</div>
                <div className="num mt-1 text-xs text-muted-foreground">
                  {vm.baseLabel}: {v(k.comparison.reference)}
                  {ratio && ` · ${formatPp(k.comparison.absolute)}`}
                </div>
              </Card>
            );
          })}
        </section>

        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
          {(["revenue", "ebitda"] as const).map((metric) => (
            <Card key={metric}>
              <CardHeader>
                <CardTitle>{metric === "revenue" ? "Revenue" : "EBITDA"} by month</CardTitle>
                <CardDescription className="flex flex-wrap gap-x-4">
                  <Legend color="var(--chart-2)" label={vm.baseLabel} />
                  <Legend color="var(--chart-1)" label={vm.forecastLabel} />
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ForecastChart data={vm.chart} metric={metric} baseLabel={vm.baseLabel} forecastLabel={vm.forecastLabel} />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Revenue & gross profit drivers</CardTitle>
            <CardDescription>{vm.forecastLabel} by category · revenue = units × average selling price</CardDescription>
            <div className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
              <Button
                variant={showFormulas ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFormulas((s) => !s)}
                aria-pressed={showFormulas}
              >
                <Sigma /> {showFormulas ? "Hide formulas" : "Show formulas"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <CategoryForecastTable rows={vm.categories} showFormulas={showFormulas} />
            {showFormulas && (
              <p className="mt-3 text-xs text-muted-foreground">
                Numbers in the formulas are rounded for display. Calculations use unrounded values, so recomputing from
                the displayed figures can differ slightly (a few thousand kroner on full-year revenue).
              </p>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Operating expenses → EBITDA</CardTitle>
              <CardDescription>Opex per account = base year × (1 + growth) · t.kr.</CardDescription>
            </CardHeader>
            <CardContent>
              <OpexForecastTable
                rows={vm.opex}
                total={vm.opexTotal}
                ebitda={vm.ebitda}
                grossProfit={vm.grossProfit.forecast}
                showFormulas={showFormulas}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Monthly forecast</CardTitle>
              <CardDescription>{vm.forecastLabel} · seasonality follows {vm.baseLabel} · t.kr.</CardDescription>
            </CardHeader>
            <CardContent>
              <MonthlyForecastTable rows={vm.months} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function LiveSummary({ vm }: { vm: ReturnType<typeof buildForecastView> }) {
  const kpi = (k: string) => vm.kpis.find((x) => x.key === k)?.comparison;
  const revenue = kpi("revenue");
  const ebitda = kpi("ebitda");
  return (
    <div
      aria-live="polite"
      className="sticky top-0 z-10 mx-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border bg-card/95 px-3 py-2 text-sm shadow-sm backdrop-blur xl:hidden"
    >
      <span className="text-muted-foreground">
        Revenue <span className="num font-semibold text-foreground">{formatDkk(revenue?.actual ?? null)}</span>
      </span>
      <span className="flex items-center gap-2 text-muted-foreground">
        EBITDA <span className="num font-semibold text-foreground">{formatDkk(ebitda?.actual ?? null)}</span>
        {ebitda && <VarianceIndicator comparison={ebitda} kind="amount" />}
      </span>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5")}>
      <span className="inline-block size-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

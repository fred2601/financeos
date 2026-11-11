import type { Metadata } from "next";
import { Suspense } from "react";
import { Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EbitdaBridgeChart } from "@/components/charts/ebitda-bridge-chart";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { FilterBar } from "@/components/filters/filter-bar";
import { FictionalDataBadge } from "@/components/layout/fictional-data-badge";
import {
  AccountVarianceTable,
  CostAnalysisTable,
  DriversList,
  RevenueAnalysisTable,
  StatusBadge,
} from "@/components/variance/variance-tables";
import { getDataset } from "@/lib/data/dataset";
import { formatDkk, formatPercent, formatPp } from "@/lib/format";
import { buildVariance, type SummaryItem } from "@/lib/selectors/variance";
import type { RevenuePvm } from "@/lib/finance/price-volume";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Budget vs actual" };

export default function VariancePage(props: PageProps<"/variance">) {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <Suspense fallback={<DashboardSkeleton />}>
        <VarianceContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function VarianceContent({ searchParams }: Pick<PageProps<"/variance">, "searchParams">) {
  const params = await searchParams;
  const vm = buildVariance(getDataset(), params);
  const { filters } = vm;
  const m = vm.materiality;

  return (
    <>
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{vm.company}</span>
            <FictionalDataBadge />
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-[28px]">Budget vs actual</h1>
          <p className="mt-1 text-sm text-muted-foreground">{vm.rangeLabel} · variance = actual − budget · DKK</p>
        </div>
        <FilterBar
          state={{ period: filters.period, view: filters.view, category: filters.category, department: filters.department }}
          periods={vm.availablePeriods}
          categories={vm.categoryOptions}
          departments={vm.departmentOptions}
        />
      </header>

      <section aria-label="Summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {vm.summary.map((s) => (
          <SummaryCard key={s.key} item={s} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>EBITDA bridge</CardTitle>
            <CardDescription>
              Company total · from budget to actual EBITDA, {vm.rangeLabel}. Green raises EBITDA, red lowers it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {vm.bridge ? (
              <EbitdaBridgeChart data={vm.bridge} />
            ) : (
              <p className="text-sm text-muted-foreground">Bridge not available: data is incomplete for this period.</p>
            )}
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Largest variances</CardTitle>
            <CardDescription>Line items ranked by EBITDA impact</CardDescription>
          </CardHeader>
          <CardContent>
            <DriversList rows={vm.drivers} />
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Variance by account</CardTitle>
          <CardDescription>
            Revenue & COGS: {vm.summary[0].scope.toLowerCase()} · Operating expenses: {vm.summary[3].scope.toLowerCase()} · t.kr.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AccountVarianceTable rows={vm.accounts} />
          {vm.filtersActive && (
            <p className="mt-3 text-xs text-muted-foreground">
              EBITDA is only shown for the company as a whole: operating expenses are not allocated to product
              categories, and revenue is not booked on departments.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Revenue analysis</CardTitle>
          <CardDescription>
            Units, average selling price and revenue by category and channel · volume effect = Δ units × budget price;
            price effect = Δ price × actual units
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {vm.pvm && <PvmSummary pvm={vm.pvm} />}
          <RevenueAnalysisTable rows={vm.revenueRows} total={vm.revenueTotal} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cost analysis</CardTitle>
          <CardDescription>Operating expenses by department and account, actual vs budget, t.kr.</CardDescription>
        </CardHeader>
        <CardContent>
          <CostAnalysisTable groups={vm.costGroups} total={vm.costTotal} />
        </CardContent>
      </Card>

      <footer className="flex gap-2 rounded-lg border bg-card px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <p>
          <strong className="font-medium text-foreground">How to read this.</strong> Variance % = (actual − budget) ÷
          |budget|. Favorable/unfavorable depends on the line: revenue above budget is favorable, costs above budget are
          unfavorable. Variances smaller than {formatPercent(m.percent, { digits: 0 })} or{" "}
          {formatDkk(m.absoluteDkk)} (margins: {formatPp(m.ratio)}) are shown as within threshold, unless they reach{" "}
          {formatDkk(m.alwaysMaterialDkk)}, which is always material. The EBITDA bridge values
          price changes at 100 % flow-through and volume at budget gross profit per unit. Figures describe what changed,
          not why. All data is fictional.
        </p>
      </footer>
    </>
  );
}

function SummaryCard({ item }: { item: SummaryItem }) {
  const c = item.comparison;
  const ratio = item.kind === "ratio";
  return (
    <Card className="gap-0 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-[13px] font-medium text-muted-foreground">{item.label}</h2>
          <div className="text-[11px] text-muted-foreground/80">{item.scope}</div>
        </div>
        <StatusBadge status={c.status} />
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span
          className={cn(
            "num text-xl font-semibold tracking-tight",
            c.status === "favorable" && "text-favorable",
            c.status === "unfavorable" && "text-unfavorable",
          )}
        >
          {ratio ? formatPp(c.absolute) : formatDkk(c.absolute, { signed: true })}
        </span>
        {!ratio && (
          <span className="num text-xs text-muted-foreground">{formatPercent(c.percent, { signed: true })}</span>
        )}
      </div>
      <dl className="num mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 border-t pt-2 text-xs">
        <dt className="text-muted-foreground">Actual</dt>
        <dd className="text-right">{ratio ? formatPercent(c.actual) : formatDkk(c.actual)}</dd>
        <dt className="text-muted-foreground">Budget</dt>
        <dd className="text-right text-muted-foreground">{ratio ? formatPercent(c.reference) : formatDkk(c.reference)}</dd>
      </dl>
    </Card>
  );
}

function PvmSummary({ pvm }: { pvm: RevenuePvm }) {
  const items = [
    { label: "Volume", value: pvm.volume, hint: "More or fewer units in total" },
    { label: "Mix", value: pvm.mix, hint: "Shift between cheaper and pricier segments" },
    { label: "Price", value: pvm.price, hint: "Higher or lower selling prices" },
    { label: "Total revenue variance", value: pvm.total, hint: "= volume + mix + price" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((i, idx) => (
        <div key={i.label} className={cn("rounded-lg border p-3", idx === 3 && "bg-muted/40")}>
          <div className="text-xs text-muted-foreground">{i.label}</div>
          <div className={cn("num mt-1 text-lg font-semibold", i.value > 0 ? "text-favorable" : i.value < 0 ? "text-unfavorable" : "")}>
            {formatDkk(i.value, { signed: true })}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{i.hint}</div>
        </div>
      ))}
    </div>
  );
}

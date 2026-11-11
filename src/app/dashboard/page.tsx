import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartLegend, EbitdaChart, MarginTrendChart, RevenueTrendChart } from "@/components/charts/dashboard-charts";
import { CategoryTable } from "@/components/dashboard/category-table";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { FilterBar } from "@/components/filters/filter-bar";
import { PnlTable } from "@/components/dashboard/pnl-table";
import { FictionalDataBadge } from "@/components/layout/fictional-data-badge";
import { getDataset } from "@/lib/data/dataset";
import { buildDashboard } from "@/lib/selectors/dashboard";

export const metadata: Metadata = { title: "Executive dashboard" };

const ACTUAL = "var(--chart-1)";
const BUDGET = "var(--chart-2)";
const SECONDARY = "var(--chart-3)";

export default function DashboardPage(props: PageProps<"/dashboard">) {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function DashboardContent({ searchParams }: Pick<PageProps<"/dashboard">, "searchParams">) {
  const params = await searchParams;
  const vm = buildDashboard(getDataset(), { period: params.period, view: params.view });

  return (
    <>
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{vm.company}</span>
            <FictionalDataBadge />
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-[28px]">Executive dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {vm.rangeLabel} · actual vs budget and {vm.priorLabel.replace("vs ", "")} · DKK
          </p>
        </div>
        <FilterBar state={{ period: vm.period, view: vm.view }} periods={vm.availablePeriods} />
      </header>

      <section aria-label="Key performance indicators" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {vm.kpis.map((kpi) => (
          <KpiCard key={kpi.key} kpi={kpi} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Revenue</CardTitle>
            <CardDescription>Monthly actual vs budget, Jan 2024 – Dec 2025</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <RevenueTrendChart data={vm.trend} />
            <ChartLegend
              items={[
                { label: "Actual (selected range highlighted)", color: ACTUAL, bar: true },
                { label: "Budget", color: BUDGET, dashed: true },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Margins</CardTitle>
            <CardDescription>Gross and EBITDA margin, % of revenue</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <MarginTrendChart data={vm.trend} />
            <ChartLegend
              items={[
                { label: "Gross margin", color: ACTUAL },
                { label: "EBITDA margin", color: SECONDARY },
                { label: "Budget", color: "var(--muted-foreground)", dashed: true },
              ]}
            />
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>P&L summary</CardTitle>
            <CardDescription>{vm.rangeLabel} · actual vs budget, t.kr.</CardDescription>
            <CardAction>
              <Link
                href={`/variance?period=${vm.period}&view=${vm.view}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                Variance analysis <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            <PnlTable rows={vm.pnl} />
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>EBITDA</CardTitle>
            <CardDescription>Monthly actual vs budget. January sales and the low season can turn EBITDA negative.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <EbitdaChart data={vm.trend} />
            <ChartLegend
              items={[
                { label: "Actual", color: ACTUAL, bar: true },
                { label: "Budget", color: BUDGET, bar: true },
              ]}
            />
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Revenue by category</CardTitle>
          <CardDescription>{vm.rangeLabel} · revenue, price and gross margin vs budget</CardDescription>
        </CardHeader>
        <CardContent>
          <CategoryTable rows={vm.categories} />
        </CardContent>
      </Card>

      <footer className="flex gap-2 rounded-lg border bg-card px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <p>
          <strong className="font-medium text-foreground">Definitions.</strong> Gross profit = revenue − COGS.
          EBITDA = gross profit − operating expenses (depreciation & amortisation excluded). Margins = metric ÷ revenue.
          Variance = actual − budget; variance % = variance ÷ |budget|. Green/red reflect whether a variance is good or
          bad for that line (e.g. costs above budget are red). Margin changes are shown in percentage points (pp).
          Figures are reported as observed; they do not explain causes. All data is fictional.
        </p>
      </footer>
    </>
  );
}

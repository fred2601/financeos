import type { Metadata } from "next";
import { Suspense } from "react";
import { Info } from "lucide-react";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { FictionalDataBadge } from "@/components/layout/fictional-data-badge";
import { ScenarioWorkspace } from "@/components/scenarios/scenario-workspace";
import { getDataset } from "@/lib/data/dataset";
import { getForecastBase } from "@/lib/selectors/forecast";
import { parseScenarios } from "@/lib/selectors/scenarios";

export const metadata: Metadata = { title: "Scenarios" };

export default function ScenariosPage(props: PageProps<"/scenarios">) {
  const base = getForecastBase(getDataset());
  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{base.company}</span>
          <FictionalDataBadge />
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-[28px]">Scenario analysis FY{base.forecastYear}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Compare a worst, base and best case for FY{base.forecastYear}, each built from FY{base.baseYear} actuals with
          three company-level levers: sales growth, gross margin change and operating expense change.
        </p>
      </header>

      <Suspense fallback={<DashboardSkeleton />}>
        <ScenarioContent searchParams={props.searchParams} />
      </Suspense>

      <footer className="flex gap-2 rounded-lg border bg-card px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <p>
          <strong className="font-medium text-foreground">Assumptions & limitations.</strong> Presets are illustrative,
          not predictions. Sales growth is applied as volume at unchanged prices and category mix; the gross margin change
          is in percentage points for every category; one opex change applies to all cost accounts (costs do not flex
          automatically with sales). Seasonality follows FY{base.baseYear}. For category-level drivers use the Forecast
          page. Green/red compare each scenario with FY{base.baseYear}. Levers are kept in the page address for sharing.
          All data is fictional.
        </p>
      </footer>
    </div>
  );
}

async function ScenarioContent({ searchParams }: Pick<PageProps<"/scenarios">, "searchParams">) {
  const params = await searchParams;
  return <ScenarioWorkspace base={getForecastBase(getDataset())} initial={parseScenarios(params)} />;
}

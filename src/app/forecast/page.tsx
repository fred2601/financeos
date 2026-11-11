import type { Metadata } from "next";
import { Suspense } from "react";
import { Info } from "lucide-react";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { ForecastWorkspace } from "@/components/forecast/forecast-workspace";
import { FictionalDataBadge } from "@/components/layout/fictional-data-badge";
import { getDataset } from "@/lib/data/dataset";
import { getForecastBase, parseAssumptions } from "@/lib/selectors/forecast";

export const metadata: Metadata = { title: "Forecast" };

export default function ForecastPage(props: PageProps<"/forecast">) {
  const base = getForecastBase(getDataset());
  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{base.company}</span>
          <FictionalDataBadge />
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-[28px]">Forecast FY{base.forecastYear}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Driver-based forecast built month by month from FY{base.baseYear} actuals: units × average selling price per
          category, gross margin in percentage points, and cost growth per account. Seasonality follows FY{base.baseYear}.
        </p>
      </header>

      <Suspense fallback={<DashboardSkeleton />}>
        <ForecastContent searchParams={props.searchParams} />
      </Suspense>

      <footer className="flex gap-2 rounded-lg border bg-card px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <p>
          <strong className="font-medium text-foreground">Assumptions & limitations.</strong> Default assumptions are
          illustrative starting points, not predictions. The base year is FY{base.baseYear} actual as reported, so any
          one-off effects in that year carry into the forecast unless you adjust for them. Drivers apply evenly to every
          month. EBITDA excludes depreciation & amortisation. Green/red compare the forecast with the base year. Your
          assumptions are kept in the page address, so you can bookmark or share a forecast. All data is fictional.
        </p>
      </footer>
    </div>
  );
}

async function ForecastContent({ searchParams }: Pick<PageProps<"/forecast">, "searchParams">) {
  const params = await searchParams;
  const base = getForecastBase(getDataset());
  return <ForecastWorkspace base={base} initial={parseAssumptions(params)} />;
}

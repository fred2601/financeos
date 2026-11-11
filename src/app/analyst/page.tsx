import type { Metadata } from "next";
import { Suspense } from "react";
import { Info } from "lucide-react";
import { AnalystWorkspace } from "@/components/analyst/analyst-workspace";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { FilterBar } from "@/components/filters/filter-bar";
import { FictionalDataBadge } from "@/components/layout/fictional-data-badge";
import { buildFactSheet } from "@/lib/analyst/fact-sheet";
import { getDataset } from "@/lib/data/dataset";
import { periodLabel, periodRange } from "@/lib/finance/periods";

export const metadata: Metadata = { title: "AI analyst" };

export default function AnalystPage(props: PageProps<"/analyst">) {
  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <Suspense fallback={<DashboardSkeleton />}>
        <AnalystContent searchParams={props.searchParams} />
      </Suspense>
      <footer className="flex gap-2 rounded-lg border bg-card px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <p>
          <strong className="font-medium text-foreground">How the AI analyst stays grounded.</strong> FinanceOS computes
          every figure with its tested finance engine and sends only this fact sheet to Claude. The model must refer to
          figures by id; the server inserts the values and discards any statement containing a number it did not get
          from the sheet. Output is separated into facts, hypotheses and recommendations. The API key is kept on the
          server. All data is fictional.
        </p>
      </footer>
    </div>
  );
}

async function AnalystContent({ searchParams }: Pick<PageProps<"/analyst">, "searchParams">) {
  const params = await searchParams;
  const dataset = getDataset();
  const sheet = buildFactSheet(dataset, { period: params.period, view: params.view });
  const periods = [...periodRange(dataset.meta.firstPeriod, dataset.meta.lastPeriod)]
    .reverse()
    .map((p) => ({ value: p, label: periodLabel(p) }));

  return (
    <>
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{sheet.company}</span>
            <FictionalDataBadge />
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-[28px]">AI financial analyst</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A concise management summary of {sheet.scopeLabel}, separating facts, hypotheses and recommendations.
          </p>
        </div>
        <FilterBar state={{ period: sheet.period, view: sheet.view }} periods={periods} />
      </header>
      <AnalystWorkspace sheet={sheet} />
    </>
  );
}

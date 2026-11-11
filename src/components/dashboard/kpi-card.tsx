import { Card } from "@/components/ui/card";
import { Sparkline } from "@/components/charts/sparkline";
import type { KpiViewModel } from "@/lib/selectors/dashboard";
import { formatDkk, formatPercent, formatPp } from "@/lib/format";
import type { Maybe } from "@/lib/finance/safe-math";
import { VarianceIndicator } from "./variance-indicator";

function formatValue(value: Maybe, kind: KpiViewModel["kind"]) {
  return kind === "ratio" ? formatPercent(value) : formatDkk(value);
}

function formatDelta(value: Maybe, kind: KpiViewModel["kind"]) {
  return kind === "ratio" ? formatPp(value) : formatDkk(value, { signed: true });
}

export function KpiCard({ kpi }: { kpi: KpiViewModel }) {
  return (
    <Card className="gap-0 p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[13px] font-medium text-muted-foreground">{kpi.label}</h3>
        <VarianceIndicator comparison={kpi.vsBudget} kind={kpi.kind} />
      </div>

      <div className="num mt-2 text-2xl font-semibold tracking-tight">{formatValue(kpi.actual, kpi.kind)}</div>

      <div className="num mt-1 text-xs text-muted-foreground">
        Budget {formatValue(kpi.budget, kpi.kind)} ·{" "}
        <span className={kpi.vsBudget.status === "unfavorable" ? "text-unfavorable" : kpi.vsBudget.status === "favorable" ? "text-favorable" : undefined}>
          {formatDelta(kpi.vsBudget.absolute, kpi.kind)}
        </span>
      </div>

      <div className="mt-3 h-10">
        <Sparkline data={kpi.sparkline} />
      </div>

      <div className="mt-3 flex items-center justify-between border-t pt-2.5 text-xs text-muted-foreground">
        <span>{kpi.priorLabel}</span>
        <VarianceIndicator comparison={kpi.vsPrior} kind={kpi.kind} className="bg-transparent px-0" />
      </div>
    </Card>
  );
}

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { Comparison, MetricKind } from "@/lib/finance/variance";
import { formatPercent, formatPp, NA } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_CLASSES = {
  favorable: "bg-favorable-soft text-favorable",
  unfavorable: "bg-unfavorable-soft text-unfavorable",
  neutral: "bg-muted text-muted-foreground",
} as const;

const STATUS_LABEL = {
  favorable: "favorable",
  unfavorable: "unfavorable",
  neutral: "no change",
} as const;

/** The headline change of a comparison: % for amounts, percentage points for ratios. */
export function headlineChange(comparison: Comparison, kind: MetricKind): string {
  return kind === "ratio"
    ? formatPp(comparison.absolute)
    : formatPercent(comparison.percent, { signed: true });
}

/**
 * Coloured chip showing a variance. The arrow shows the mathematical direction;
 * the colour shows whether that is good or bad for this line.
 */
export function VarianceIndicator({
  comparison,
  kind,
  className,
}: {
  comparison: Comparison;
  kind: MetricKind;
  className?: string;
}) {
  const text = headlineChange(comparison, kind);
  const { absolute, status } = comparison;
  const Icon = absolute === null || absolute === 0 || text === NA ? Minus : absolute > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "num inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium",
        STATUS_CLASSES[status],
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {text}
      <span className="sr-only"> ({STATUS_LABEL[status]})</span>
    </span>
  );
}

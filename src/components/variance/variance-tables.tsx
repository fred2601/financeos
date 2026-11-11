import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VarianceIndicator } from "@/components/dashboard/variance-indicator";
import type { Favorability, MetricKind } from "@/lib/finance/variance";
import type { Maybe } from "@/lib/finance/safe-math";
import type { AccountRow, CostGroup, DriverRow, RevenueRow } from "@/lib/selectors/variance";
import type { Comparison } from "@/lib/finance/variance";
import { formatDkk, formatNumber, formatPercent, formatPp } from "@/lib/format";
import { cn } from "@/lib/utils";

const tone = (s: Favorability) => (s === "favorable" ? "text-favorable" : s === "unfavorable" ? "text-unfavorable" : "");
const t = (v: Maybe, signed = false) => formatDkk(v, { scale: "t", signed });

export function StatusBadge({ status }: { status: Favorability }) {
  const label = status === "favorable" ? "Favorable" : status === "unfavorable" ? "Unfavorable" : "Within threshold";
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        status === "favorable" && "border-favorable/30 bg-favorable-soft text-favorable",
        status === "unfavorable" && "border-unfavorable/30 bg-unfavorable-soft text-unfavorable",
        status === "neutral" && "text-muted-foreground",
      )}
    >
      {label}
    </Badge>
  );
}

function amountOrRatio(v: Maybe, kind: MetricKind) {
  return kind === "ratio" ? formatPercent(v) : t(v);
}

/** P&L accounts: actual, budget, variance, % and EBITDA impact. */
export function AccountVarianceTable({ rows }: { rows: AccountRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Account</TableHead>
          <TableHead className="text-right">Actual</TableHead>
          <TableHead className="text-right">Budget</TableHead>
          <TableHead className="text-right">Variance</TableHead>
          <TableHead className="text-right">Var. %</TableHead>
          <TableHead className="hidden text-right md:table-cell">EBITDA impact</TableHead>
          <TableHead className="text-right">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const c = r.comparison;
          const ratio = r.kind === "ratio";
          return (
            <TableRow
              key={r.key}
              className={cn(
                r.level === "subtotal" && "bg-muted/40 font-semibold",
                r.level === "total" && "border-t-2 bg-muted/60 font-semibold",
              )}
            >
              <TableCell className={cn(ratio && "pl-6 text-muted-foreground", r.level === "account" && !ratio && r.key.startsWith("OPEX_") && "pl-6")}>
                {r.label}
              </TableCell>
              <TableCell className="num text-right">{amountOrRatio(c.actual, r.kind)}</TableCell>
              <TableCell className="num text-right text-muted-foreground">{amountOrRatio(c.reference, r.kind)}</TableCell>
              <TableCell className={cn("num text-right", tone(c.status))}>
                {ratio ? formatPp(c.absolute) : t(c.absolute, true)}
              </TableCell>
              <TableCell className="num text-right text-muted-foreground">
                {ratio ? "" : formatPercent(c.percent, { signed: true })}
              </TableCell>
              <TableCell className={cn("num hidden text-right md:table-cell", tone(c.status))}>
                {ratio ? "" : t(r.ebitdaImpact, true)}
              </TableCell>
              <TableCell className="text-right">
                <StatusBadge status={c.status} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/** Top line items by absolute EBITDA impact, with a proportional bar. */
export function DriversList({ rows }: { rows: DriverRow[] }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.ebitdaImpact)));
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No variances for this selection.</p>;
  return (
    <ol className="flex flex-col divide-y">
      {rows.map((r, i) => {
        const width = `${(Math.abs(r.ebitdaImpact) / max) * 100}%`;
        return (
          <li key={r.key} className="flex items-center gap-3 py-2.5">
            <span className="num w-4 text-xs text-muted-foreground">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <div className="truncate text-sm font-medium">{r.label}</div>
                <div className={cn("num shrink-0 text-sm font-medium", tone(r.comparison.status))}>
                  {formatDkk(r.ebitdaImpact, { signed: true })}
                </div>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="w-28 shrink-0 truncate text-xs text-muted-foreground">{r.detail}</span>
                <div className="h-1.5 flex-1 rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      r.comparison.status === "favorable" && "bg-favorable",
                      r.comparison.status === "unfavorable" && "bg-unfavorable",
                      r.comparison.status === "neutral" && "bg-muted-foreground/40",
                    )}
                    style={{ width }}
                  />
                </div>
                <span className="num w-14 shrink-0 text-right text-xs text-muted-foreground">
                  {formatPercent(r.comparison.percent, { signed: true })}
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function DriverCells({ c }: { c: Comparison }) {
  return (
    <>
      <TableCell className="num hidden text-right lg:table-cell">{formatNumber(c.actual)}</TableCell>
      <TableCell className="hidden text-right lg:table-cell">
        <VarianceIndicator comparison={c} kind="driver" className="bg-transparent px-0" />
      </TableCell>
    </>
  );
}

/** Revenue by category × channel with units, price and the volume/price split. */
export function RevenueAnalysisTable({ rows, total }: { rows: RevenueRow[]; total: RevenueRow }) {
  const line = (r: RevenueRow, isTotal = false) => (
    <TableRow key={r.key} className={cn(isTotal && "font-semibold")}>
      <TableCell>
        {r.category}
        {r.channel && <span className="text-muted-foreground"> · {r.channel}</span>}
      </TableCell>
      <DriverCells c={r.units} />
      <TableCell className="num hidden text-right md:table-cell">{formatDkk(r.asp.actual, { scale: "kr" })}</TableCell>
      <TableCell className="hidden text-right md:table-cell">
        <VarianceIndicator comparison={r.asp} kind="driver" className="bg-transparent px-0" />
      </TableCell>
      <TableCell className="num text-right">{t(r.revenue.actual)}</TableCell>
      <TableCell className={cn("num text-right", tone(r.revenue.status))}>{t(r.revenue.absolute, true)}</TableCell>
      <TableCell className="num hidden text-right sm:table-cell">{t(r.volumeEffect, true)}</TableCell>
      <TableCell className="num hidden text-right sm:table-cell">{t(r.priceEffect, true)}</TableCell>
    </TableRow>
  );
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Segment</TableHead>
          <TableHead className="hidden text-right lg:table-cell">Units</TableHead>
          <TableHead className="hidden text-right lg:table-cell">vs bud.</TableHead>
          <TableHead className="hidden text-right md:table-cell">Avg. price</TableHead>
          <TableHead className="hidden text-right md:table-cell">vs bud.</TableHead>
          <TableHead className="text-right">Revenue</TableHead>
          <TableHead className="text-right">Variance</TableHead>
          <TableHead className="hidden text-right sm:table-cell">Volume effect</TableHead>
          <TableHead className="hidden text-right sm:table-cell">Price effect</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{rows.map((r) => line(r))}</TableBody>
      <TableFooter>{line(total, true)}</TableFooter>
    </Table>
  );
}

/** Operating expenses grouped by department. */
export function CostAnalysisTable({ groups, total }: { groups: CostGroup[]; total: Comparison }) {
  const cells = (c: Comparison) => (
    <>
      <TableCell className="num text-right">{t(c.actual)}</TableCell>
      <TableCell className="num text-right text-muted-foreground">{t(c.reference)}</TableCell>
      <TableCell className={cn("num text-right", tone(c.status))}>{t(c.absolute, true)}</TableCell>
      <TableCell className="text-right">
        <VarianceIndicator comparison={c} kind="amount" />
      </TableCell>
    </>
  );
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Department / account</TableHead>
          <TableHead className="text-right">Actual</TableHead>
          <TableHead className="text-right">Budget</TableHead>
          <TableHead className="text-right">Variance</TableHead>
          <TableHead className="text-right">Var. %</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.flatMap((g) => [
          <TableRow key={g.department} className="bg-muted/40 font-semibold">
            <TableCell>{g.label}</TableCell>
            {cells(g.subtotal)}
          </TableRow>,
          ...g.lines.map((l) => (
            <TableRow key={l.key}>
              <TableCell className="pl-6 text-muted-foreground">{l.label}</TableCell>
              {cells(l.comparison)}
            </TableRow>
          )),
        ])}
      </TableBody>
      <TableFooter>
        <TableRow className="font-semibold">
          <TableCell>Total operating expenses</TableCell>
          {cells(total)}
        </TableRow>
      </TableFooter>
    </Table>
  );
}

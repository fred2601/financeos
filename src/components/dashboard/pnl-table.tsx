import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PnlRow } from "@/lib/selectors/dashboard";
import { formatDkk, formatPercent, formatPp } from "@/lib/format";
import { cn } from "@/lib/utils";
import { VarianceIndicator } from "./variance-indicator";

/** Condensed P&L: actual vs budget. Values pre-computed by the selector. */
export function PnlTable({ rows }: { rows: PnlRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Line</TableHead>
          <TableHead className="text-right">Actual</TableHead>
          <TableHead className="text-right">Budget</TableHead>
          <TableHead className="text-right">Variance</TableHead>
          <TableHead className="text-right">Var. %</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const ratio = row.kind === "ratio";
          const value = (v: number | null) => (ratio ? formatPercent(v) : formatDkk(v, { scale: "t" }));
          const c = row.comparison;
          return (
            <TableRow
              key={row.key}
              className={cn(row.emphasis && "bg-muted/40 font-semibold", row.memo && "text-muted-foreground")}
            >
              <TableCell className={cn(ratio && "pl-6 text-muted-foreground", row.memo && "text-xs italic")}>
                {row.label}
              </TableCell>
              <TableCell className="num text-right">{value(c.actual)}</TableCell>
              <TableCell className="num text-right text-muted-foreground">{value(c.reference)}</TableCell>
              <TableCell
                className={cn(
                  "num text-right",
                  !row.memo && c.status === "favorable" && "text-favorable",
                  !row.memo && c.status === "unfavorable" && "text-unfavorable",
                )}
              >
                {ratio ? formatPp(c.absolute) : formatDkk(c.absolute, { scale: "t", signed: true })}
              </TableCell>
              <TableCell className="text-right">
                {ratio ? null : <VarianceIndicator comparison={c} kind={row.kind} />}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CategoryRow } from "@/lib/selectors/dashboard";
import { formatDkk, formatPercent, formatPp } from "@/lib/format";
import { cn } from "@/lib/utils";
import { VarianceIndicator } from "./variance-indicator";

const statusText = (s: string) => (s === "favorable" ? "text-favorable" : s === "unfavorable" ? "text-unfavorable" : "");

/** Revenue and gross margin by product category vs budget. */
export function CategoryTable({ rows }: { rows: CategoryRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Category</TableHead>
          <TableHead className="text-right">Revenue</TableHead>
          <TableHead className="text-right">vs budget</TableHead>
          <TableHead className="hidden text-right sm:table-cell">Mix</TableHead>
          <TableHead className="hidden text-right md:table-cell">Avg. price</TableHead>
          <TableHead className="text-right">Gross margin</TableHead>
          <TableHead className="text-right">vs budget</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const total = row.id === "total";
          return (
            <TableRow key={row.id} className={cn(total && "border-t-2 bg-muted/40 font-semibold")}>
              <TableCell>{row.label}</TableCell>
              <TableCell className="num text-right">{formatDkk(row.revenue.actual, { scale: "t" })}</TableCell>
              <TableCell className="text-right">
                <VarianceIndicator comparison={row.revenue} kind="amount" />
              </TableCell>
              <TableCell className="num hidden text-right text-muted-foreground sm:table-cell">
                {formatPercent(row.revenueShare, { digits: 0 })}
              </TableCell>
              <TableCell className="num hidden text-right md:table-cell">
                {formatDkk(row.averageSellingPrice.actual, { scale: "kr" })}
              </TableCell>
              <TableCell className="num text-right">{formatPercent(row.grossMargin.actual)}</TableCell>
              <TableCell className={cn("num text-right text-sm", statusText(row.grossMargin.status))}>
                {formatPp(row.grossMargin.absolute)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

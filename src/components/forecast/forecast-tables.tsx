import { Fragment } from "react";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CategoryFormula, MonthRow, OpexFormula } from "@/lib/selectors/forecast";
import type { Maybe } from "@/lib/finance/safe-math";
import { formatDkk, formatNumber, formatPercent, formatPp } from "@/lib/format";
import { cn } from "@/lib/utils";

const t = (v: Maybe) => formatDkk(v, { scale: "t" });
const signedPct = (v: number) => formatPercent(v, { signed: true });
/** "+ 2,0 %" / "− 2,0 %": an operator and a magnitude, for readable formulas. */
const op = (v: number, format: (x: number) => string) => `${v < 0 ? "−" : "+"} ${format(Math.abs(v))}`;
const opPct = (v: number) => op(v, (x) => formatPercent(x));
const opPp = (v: number) => op(v, (x) => formatPp(x, 2).replace(/^\+/, ""));

/** Shows the formula with the actual numbers plugged in. */
function Formula({ children }: { children: React.ReactNode }) {
  return <code className="num rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">{children}</code>;
}

export function CategoryForecastTable({
  rows,
  showFormulas,
}: {
  rows: CategoryFormula[];
  showFormulas: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Category</TableHead>
          <TableHead className="text-right">Units</TableHead>
          <TableHead className="text-right">Avg. price</TableHead>
          <TableHead className="text-right">Revenue</TableHead>
          <TableHead className="hidden text-right sm:table-cell">vs base</TableHead>
          <TableHead className="text-right">Gross margin</TableHead>
          <TableHead className="text-right">Gross profit</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          return (
            <Fragment key={r.id}>
              <TableRow className={cn(showFormulas && "border-b-0")}>
                <TableCell className="font-medium">{r.label}</TableCell>
                <TableCell className="num text-right">{formatNumber(r.unitsForecast)}</TableCell>
                <TableCell className="num text-right">{formatDkk(r.aspForecast, { scale: "kr" })}</TableCell>
                <TableCell className="num text-right">{t(r.revenueForecast)}</TableCell>
                <TableCell className="num hidden text-right text-muted-foreground sm:table-cell">
                  {formatPercent(r.revenueChange, { signed: true })}
                </TableCell>
                <TableCell className="num text-right">{formatPercent(r.grossMarginForecast)}</TableCell>
                <TableCell className="num text-right">{t(r.grossProfitForecast)}</TableCell>
              </TableRow>
              {showFormulas && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="pt-0 pb-3">
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                      <div>
                        Units: <Formula>{formatNumber(r.unitsBase)} × (1 {opPct(r.unitGrowth)}) = {formatNumber(r.unitsForecast)}</Formula>
                      </div>
                      <div>
                        Avg. price:{" "}
                        <Formula>
                          {formatDkk(r.aspBase, { scale: "kr", digits: 2 })} × (1 {opPct(r.priceChange)}) ={" "}
                          {formatDkk(r.aspForecast, { scale: "kr", digits: 2 })}
                        </Formula>
                      </div>
                      <div>
                        Revenue:{" "}
                        <Formula>
                          {formatNumber(r.unitsForecast)} × {formatDkk(r.aspForecast, { scale: "kr", digits: 2 })} ={" "}
                          {formatDkk(r.revenueForecast, { scale: "kr" })}
                        </Formula>
                      </div>
                      <div>
                        Gross margin:{" "}
                        <Formula>
                          {formatPercent(r.grossMarginBase, { digits: 2 })} {opPp(r.marginChange)} ={" "}
                          {formatPercent(r.grossMarginForecast, { digits: 2 })}
                        </Formula>{" "}
                        → Gross profit:{" "}
                        <Formula>
                          {formatDkk(r.revenueForecast, { scale: "t" })} × {formatPercent(r.grossMarginForecast, { digits: 2 })} ={" "}
                          {formatDkk(r.grossProfitForecast, { scale: "t" })}
                        </Formula>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function OpexForecastTable({
  rows,
  total,
  ebitda,
  grossProfit,
  showFormulas,
}: {
  rows: OpexFormula[];
  total: { base: Maybe; forecast: Maybe };
  ebitda: { base: Maybe; forecast: Maybe };
  grossProfit: Maybe;
  showFormulas: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Account</TableHead>
          <TableHead className="text-right">Base year</TableHead>
          <TableHead className="text-right">Growth</TableHead>
          <TableHead className="text-right">Forecast</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell>
              {r.label}
              {showFormulas && (
                <div className="mt-1 text-xs text-muted-foreground">
                  <Formula>
                    {t(r.base)} × (1 {opPct(r.growth)}) = {t(r.forecast)}
                  </Formula>
                </div>
              )}
            </TableCell>
            <TableCell className="num text-right text-muted-foreground">{t(r.base)}</TableCell>
            <TableCell className="num text-right">{signedPct(r.growth)}</TableCell>
            <TableCell className="num text-right">{t(r.forecast)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow className="font-semibold">
          <TableCell>Operating expenses</TableCell>
          <TableCell className="num text-right text-muted-foreground">{t(total.base)}</TableCell>
          <TableCell />
          <TableCell className="num text-right">{t(total.forecast)}</TableCell>
        </TableRow>
        <TableRow className="font-semibold">
          <TableCell>
            EBITDA
            {showFormulas && (
              <div className="mt-1 text-xs font-normal text-muted-foreground">
                <Formula>
                  {t(grossProfit)} − {t(total.forecast)} = {t(ebitda.forecast)}
                </Formula>
              </div>
            )}
          </TableCell>
          <TableCell className="num text-right text-muted-foreground">{t(ebitda.base)}</TableCell>
          <TableCell />
          <TableCell className="num text-right">{t(ebitda.forecast)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}

export function MonthlyForecastTable({ rows }: { rows: MonthRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Month</TableHead>
          <TableHead className="text-right">Revenue</TableHead>
          <TableHead className="hidden text-right sm:table-cell">Gross profit</TableHead>
          <TableHead className="text-right">GM %</TableHead>
          <TableHead className="hidden text-right sm:table-cell">Opex</TableHead>
          <TableHead className="text-right">EBITDA</TableHead>
          <TableHead className="text-right">EBITDA %</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.label}>
            <TableCell>{r.label}</TableCell>
            <TableCell className="num text-right">{t(r.revenue)}</TableCell>
            <TableCell className="num hidden text-right sm:table-cell">{t(r.grossProfit)}</TableCell>
            <TableCell className="num text-right">{formatPercent(r.grossMargin)}</TableCell>
            <TableCell className="num hidden text-right sm:table-cell">{t(r.opex)}</TableCell>
            <TableCell className={cn("num text-right", (r.ebitda ?? 0) < 0 && "text-unfavorable")}>{t(r.ebitda)}</TableCell>
            <TableCell className="num text-right text-muted-foreground">{formatPercent(r.ebitdaMargin)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

"use client";

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendPoint } from "@/lib/selectors/dashboard";
import { formatDkk, formatPercent, formatPp } from "@/lib/format";
import { safeSubtract } from "@/lib/finance/safe-math";
import { axisTick, ChartTooltipPanel, hoveredPoint } from "./chart-tooltip";

const ACTUAL = "var(--chart-1)";
const BUDGET = "var(--chart-2)";
const SECONDARY = "var(--chart-3)";
const HEIGHT = 260;

const mioTick = (v: number) => formatDkk(v, { scale: "mio", digits: 0 }).replace(" mio. kr.", "m");
const pctTick = (v: number) => formatPercent(v, { digits: 0 });

/** Monthly revenue: actual bars vs budget line. Selected period(s) highlighted. */
export function RevenueTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div role="img" aria-label={"Bar chart: monthly revenue, actual versus budget. Exact figures are in the tables on this page."}>
    <ResponsiveContainer width="100%" height={HEIGHT} initialDimension={{ width: 600, height: HEIGHT }}>
      <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={18} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={mioTick} width={44} />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          content={({ payload }) => {
            const p = hoveredPoint<TrendPoint>(payload);
            if (!p) return null;
            return (
              <ChartTooltipPanel
                title={p.label}
                rows={[
                  { label: "Actual", value: formatDkk(p.revenueActual), color: ACTUAL },
                  { label: "Budget", value: formatDkk(p.revenueBudget), color: BUDGET, dashed: true },
                ]}
                footer={`Variance ${formatDkk(safeSubtract(p.revenueActual, p.revenueBudget), { signed: true })}`}
              />
            );
          }}
        />
        <Bar dataKey="revenueActual" name="Actual" radius={[3, 3, 0, 0]} isAnimationActive={false} maxBarSize={22}>
          {data.map((d) => (
            <Cell key={d.period} fill={ACTUAL} fillOpacity={d.inRange ? 1 : 0.35} />
          ))}
        </Bar>
        <Line
          dataKey="revenueBudget"
          name="Budget"
          stroke={BUDGET}
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={false}
          type="monotone"
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
    </div>
  );
}

/** Monthly EBITDA: actual vs budget bars, negative months below the zero line. */
export function EbitdaChart({ data }: { data: TrendPoint[] }) {
  return (
    <div role="img" aria-label={"Bar chart: monthly EBITDA, actual versus budget. Exact figures are in the P&L summary."}>
    <ResponsiveContainer width="100%" height={HEIGHT} initialDimension={{ width: 600, height: HEIGHT }}>
      <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={1}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={18} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={mioTick} width={44} />
        <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.5} />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          content={({ payload }) => {
            const p = hoveredPoint<TrendPoint>(payload);
            if (!p) return null;
            return (
              <ChartTooltipPanel
                title={p.label}
                rows={[
                  { label: "Actual", value: formatDkk(p.ebitdaActual), color: ACTUAL },
                  { label: "Budget", value: formatDkk(p.ebitdaBudget), color: BUDGET },
                ]}
                footer={`Variance ${formatDkk(safeSubtract(p.ebitdaActual, p.ebitdaBudget), { signed: true })}`}
              />
            );
          }}
        />
        <Bar dataKey="ebitdaBudget" name="Budget" fill={BUDGET} radius={[2, 2, 0, 0]} isAnimationActive={false} maxBarSize={10} />
        <Bar dataKey="ebitdaActual" name="Actual" radius={[2, 2, 0, 0]} isAnimationActive={false} maxBarSize={10}>
          {data.map((d) => (
            <Cell key={d.period} fill={ACTUAL} fillOpacity={d.inRange ? 1 : 0.35} />
          ))}
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
    </div>
  );
}

/** Gross margin and EBITDA margin, actual (solid) vs budget (dashed). */
export function MarginTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div role="img" aria-label={"Line chart: gross margin and EBITDA margin by month, actual versus budget."}>
    <ResponsiveContainer width="100%" height={HEIGHT} initialDimension={{ width: 600, height: HEIGHT }}>
      <LineChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={18} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={pctTick} width={44} />
        <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.5} />
        <Tooltip
          content={({ payload }) => {
            const p = hoveredPoint<TrendPoint>(payload);
            if (!p) return null;
            return (
              <ChartTooltipPanel
                title={p.label}
                rows={[
                  { label: "Gross margin", value: formatPercent(p.grossMarginActual), color: ACTUAL },
                  { label: "Gross margin budget", value: formatPercent(p.grossMarginBudget), color: ACTUAL, dashed: true },
                  { label: "EBITDA margin", value: formatPercent(p.ebitdaMarginActual), color: SECONDARY },
                  { label: "EBITDA margin budget", value: formatPercent(p.ebitdaMarginBudget), color: SECONDARY, dashed: true },
                ]}
                footer={`EBITDA margin vs budget ${formatPp(safeSubtract(p.ebitdaMarginActual, p.ebitdaMarginBudget))}`}
              />
            );
          }}
        />
        <Line dataKey="grossMarginActual" stroke={ACTUAL} strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line dataKey="grossMarginBudget" stroke={ACTUAL} strokeOpacity={0.45} strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
        <Line dataKey="ebitdaMarginActual" stroke={SECONDARY} strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line dataKey="ebitdaMarginBudget" stroke={SECONDARY} strokeOpacity={0.5} strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
    </div>
  );
}

export function ChartLegend({ items }: { items: { label: string; color: string; dashed?: boolean; bar?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          {i.bar ? (
            <span className="inline-block size-2.5 rounded-sm" style={{ background: i.color }} />
          ) : (
            <span
              className="inline-block w-4"
              style={{ borderTop: `2px ${i.dashed ? "dashed" : "solid"} ${i.color}` }}
            />
          )}
          {i.label}
        </span>
      ))}
    </div>
  );
}


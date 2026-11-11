"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlyEbitdaPoint, ScenarioViewModel } from "@/lib/selectors/scenarios";
import { formatDkk } from "@/lib/format";
import { axisTick, ChartTooltipPanel, hoveredPoint } from "./chart-tooltip";

export const SCENARIO_COLORS = {
  baseYear: "var(--chart-2)",
  worst: "var(--unfavorable)",
  base: "var(--chart-1)",
  best: "var(--favorable)",
} as const;

const mio = (v: number) => formatDkk(v, { scale: "mio", digits: 0 }).replace(" mio. kr.", "m");
const mio1 = (v: number) => formatDkk(v, { scale: "mio", digits: 1 }).replace(" mio. kr.", "m");

type Bars = ScenarioViewModel["ebitdaBars"];

/** Full-year EBITDA: base year actual vs the three scenarios. */
export function ScenarioEbitdaChart({ data }: { data: Bars }) {
  return (
    <ResponsiveContainer width="100%" height={260} initialDimension={{ width: 500, height: 260 }}>
      <BarChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={mio} width={44} />
        <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.5} />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          content={({ payload }) => {
            const p = hoveredPoint<Bars[number]>(payload);
            if (!p) return null;
            return <ChartTooltipPanel title={p.label} rows={[{ label: "EBITDA", value: formatDkk(p.ebitda), color: SCENARIO_COLORS[p.id] }]} />;
          }}
        />
        <Bar dataKey="ebitda" radius={[3, 3, 0, 0]} maxBarSize={56} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.id} fill={SCENARIO_COLORS[d.id]} />
          ))}
          <LabelList
            dataKey="ebitda"
            position="top"
            style={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            formatter={(v: unknown) => (typeof v === "number" ? mio1(v) : "")}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

const SERIES: { key: keyof Omit<MonthlyEbitdaPoint, "month">; label: string }[] = [
  { key: "baseYear", label: "Base year" },
  { key: "worst", label: "Worst" },
  { key: "base", label: "Base" },
  { key: "best", label: "Best" },
];

/** Monthly EBITDA per scenario; seasonality follows the base year. */
export function ScenarioMonthlyChart({ data, baseLabel }: { data: MonthlyEbitdaPoint[]; baseLabel: string }) {
  return (
    <ResponsiveContainer width="100%" height={260} initialDimension={{ width: 600, height: 260 }}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="month" tick={axisTick} tickLine={false} axisLine={false} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={mio} width={44} />
        <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.5} />
        <Tooltip
          content={({ payload }) => {
            const p = hoveredPoint<MonthlyEbitdaPoint>(payload);
            if (!p) return null;
            return (
              <ChartTooltipPanel
                title={p.month}
                rows={SERIES.map((s) => ({
                  label: s.key === "baseYear" ? baseLabel : s.label,
                  value: formatDkk(p[s.key]),
                  color: SCENARIO_COLORS[s.key],
                  dashed: s.key === "baseYear",
                }))}
              />
            );
          }}
        />
        {SERIES.map((s) => (
          <Line
            key={s.key}
            dataKey={s.key}
            stroke={SCENARIO_COLORS[s.key]}
            strokeWidth={s.key === "base" ? 2.5 : 1.75}
            strokeDasharray={s.key === "baseYear" ? "4 4" : undefined}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

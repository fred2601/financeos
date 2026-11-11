"use client";

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ForecastChartPoint } from "@/lib/selectors/forecast";
import { formatDkk } from "@/lib/format";
import { safeSubtract } from "@/lib/finance/safe-math";
import { axisTick, ChartTooltipPanel, hoveredPoint } from "./chart-tooltip";

const BASE = "var(--chart-2)";
const FORECAST = "var(--chart-1)";
const mio = (v: number) => formatDkk(v, { scale: "mio", digits: 0 }).replace(" mio. kr.", "m");

/** Monthly base-year actual vs forecast for revenue or EBITDA. */
export function ForecastChart({
  data,
  metric,
  baseLabel,
  forecastLabel,
}: {
  data: ForecastChartPoint[];
  metric: "revenue" | "ebitda";
  baseLabel: string;
  forecastLabel: string;
}) {
  const baseKey = metric === "revenue" ? "revenueBase" : "ebitdaBase";
  const fcKey = metric === "revenue" ? "revenueForecast" : "ebitdaForecast";
  return (
    <ResponsiveContainer width="100%" height={240} initialDimension={{ width: 600, height: 240 }}>
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={1}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="month" tick={axisTick} tickLine={false} axisLine={false} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={mio} width={44} />
        <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.5} />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          content={({ payload }) => {
            const p = hoveredPoint<ForecastChartPoint>(payload);
            if (!p) return null;
            return (
              <ChartTooltipPanel
                title={p.month}
                rows={[
                  { label: baseLabel, value: formatDkk(p[baseKey]), color: BASE },
                  { label: forecastLabel, value: formatDkk(p[fcKey]), color: FORECAST },
                ]}
                footer={`Change ${formatDkk(safeSubtract(p[fcKey], p[baseKey]), { signed: true })}`}
              />
            );
          }}
        />
        <Bar dataKey={baseKey} fill={BASE} radius={[2, 2, 0, 0]} maxBarSize={14} isAnimationActive={false} />
        <Bar dataKey={fcKey} fill={FORECAST} radius={[2, 2, 0, 0]} maxBarSize={14} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

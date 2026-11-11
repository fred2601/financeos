"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BridgeStep } from "@/lib/selectors/variance";
import { formatDkk } from "@/lib/format";
import { axisTick, ChartTooltipPanel, hoveredPoint } from "./chart-tooltip";

const COLORS = {
  total: "var(--chart-1)",
  increase: "var(--favorable)",
  decrease: "var(--unfavorable)",
} as const;

const mio = (v: number) => formatDkk(v, { scale: "mio", digits: 1 }).replace(" mio. kr.", "m");

/**
 * Waterfall from budget EBITDA to actual EBITDA. Each bar floats between its start and end
 * value (pre-computed in the selector as `range`).
 */
export function EbitdaBridgeChart({ data }: { data: BridgeStep[] }) {
  return (
    <ResponsiveContainer width="100%" height={320} initialDimension={{ width: 800, height: 320 }}>
      <BarChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="label"
          tick={{ ...axisTick, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval={0}
          height={48}
          angle={-30}
          textAnchor="end"
        />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(v: number) => mio(v)} width={48} />
        <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.5} />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          content={({ payload }) => {
            const p = hoveredPoint<BridgeStep>(payload);
            if (!p) return null;
            return (
              <ChartTooltipPanel
                title={p.label}
                rows={[
                  {
                    label: p.type === "total" ? "EBITDA" : "Effect on EBITDA",
                    value: formatDkk(p.value, { signed: p.type !== "total" }),
                    color: COLORS[p.type],
                  },
                ]}
              />
            );
          }}
        />
        <Bar dataKey="range" isAnimationActive={false} radius={2} maxBarSize={44}>
          {data.map((d) => (
            <Cell key={d.key} fill={COLORS[d.type]} />
          ))}
          <LabelList
            dataKey="value"
            position="top"
            className="num"
            style={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            formatter={(v: unknown) => (typeof v === "number" ? mio(v) : "")}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

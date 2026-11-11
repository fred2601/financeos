"use client";

import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import type { Maybe } from "@/lib/finance/safe-math";

/** Tiny trend line for KPI cards. Purely visual: values come pre-computed. */
export function Sparkline({ data }: { data: { period: string; value: Maybe }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 200, height: 40 }}>
      <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Line
          type="monotone"
          dataKey="value"
          stroke="var(--chart-1)"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

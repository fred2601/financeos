"use client";

import type { Maybe } from "@/lib/finance/safe-math";

export interface TooltipRow {
  label: string;
  value: string;
  color: string;
  dashed?: boolean;
}

/** Shared tooltip panel so all charts look the same. */
export function ChartTooltipPanel({ title, rows, footer }: { title: string; rows: TooltipRow[]; footer?: string }) {
  return (
    <div className="min-w-44 rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="mb-1.5 font-medium text-foreground">{title}</div>
      <div className="flex flex-col gap-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="inline-block h-0.5 w-3 rounded"
                style={{ background: r.dashed ? "transparent" : r.color, borderTop: r.dashed ? `2px dashed ${r.color}` : undefined }}
              />
              {r.label}
            </span>
            <span className="num font-medium text-foreground">{r.value}</span>
          </div>
        ))}
      </div>
      {footer && <div className="num mt-1.5 border-t pt-1.5 text-muted-foreground">{footer}</div>}
    </div>
  );
}

/** Recharts passes the hovered data point as payload[0].payload. */
export function hoveredPoint<T>(payload: ReadonlyArray<{ payload?: unknown }> | undefined): T | undefined {
  const first = payload?.[0]?.payload;
  return first === undefined ? undefined : (first as T);
}

export const axisTick = { fontSize: 11, fill: "var(--muted-foreground)" };

export const isPresent = (v: Maybe): v is number => v !== null;

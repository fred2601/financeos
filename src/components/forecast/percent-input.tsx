"use client";

import { useId, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Numeric input for an assumption stored as a fraction (0.035) but edited in % or pp (3,5).
 * Keeps a local draft while typing so intermediate states like "-" or "3," are allowed.
 */
export function PercentInput({
  label,
  value,
  onChange,
  unit = "%",
  step = 0.5,
  min,
  max,
  className,
}: {
  label: string;
  value: number;
  onChange: (fraction: number) => void;
  unit?: "%" | "pp";
  step?: number;
  min: number;
  max: number;
  className?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const display = (Math.round(value * 10_000) / 100).toString().replace(".", ",");

  const commit = (percent: number) => {
    const fraction = Math.min(max, Math.max(min, percent / 100));
    onChange(Math.round(fraction * 10_000) / 10_000);
  };

  const nudge = (direction: 1 | -1) => {
    setDraft(null);
    commit(Math.round((value * 100 + direction * step) * 100) / 100);
  };

  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <label htmlFor={id} className="text-sm text-muted-foreground">
        {label}
      </label>
      <div className="flex items-center rounded-md border bg-card focus-within:ring-2 focus-within:ring-ring/40">
        <button
          type="button"
          onClick={() => nudge(-1)}
          className="grid size-7 place-items-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Decrease ${label}`}
        >
          <Minus className="size-3.5" />
        </button>
        <input
          id={id}
          inputMode="decimal"
          className="num w-12 bg-transparent text-right text-sm outline-none"
          value={draft ?? display}
          onChange={(e) => {
            const text = e.target.value;
            setDraft(text);
            const n = Number(text.replace(",", "."));
            if (text.trim() !== "" && Number.isFinite(n)) commit(n);
          }}
          onBlur={() => setDraft(null)}
        />
        <span className="pr-1 pl-0.5 text-xs text-muted-foreground">{unit}</span>
        <button
          type="button"
          onClick={() => nudge(1)}
          className="grid size-7 place-items-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Increase ${label}`}
        >
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

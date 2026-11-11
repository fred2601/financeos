"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CalendarDays } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DashboardView } from "@/lib/selectors/dashboard";
import { cn } from "@/lib/utils";

/**
 * Period and view selector. State lives in the URL (?period=2025-10&view=ytd),
 * so every view can be bookmarked and shared.
 */
export function PeriodControls({
  period,
  view,
  periods,
}: {
  period: string;
  view: DashboardView;
  periods: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const navigate = (next: { period?: string; view?: DashboardView }) => {
    const params = new URLSearchParams({ period: next.period ?? period, view: next.view ?? view });
    startTransition(() => router.push(`/dashboard?${params.toString()}`, { scroll: false }));
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2 transition-opacity", pending && "opacity-60")}>
      <div className="inline-flex rounded-lg border bg-card p-0.5" role="group" aria-label="View">
        {(["month", "ytd"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => navigate({ view: v })}
            aria-pressed={view === v}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium transition-colors",
              view === v ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {v === "month" ? "Month" : "Year to date"}
          </button>
        ))}
      </div>

      <Select
        items={periods}
        value={period}
        onValueChange={(value) => {
          if (typeof value === "string") navigate({ period: value });
        }}
      >
        <SelectTrigger className="min-w-40 bg-card" aria-label="Period">
          <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {periods.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

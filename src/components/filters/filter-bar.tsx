"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Building2, CalendarDays, Tag, type LucideIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

export interface FilterBarProps {
  /** Current filter state, mirrored in the URL. `null` = filter not set. */
  state: Record<string, string | null>;
  periods: Option[];
  categories?: Option[];
  departments?: Option[];
}

const ALL = "all";

/**
 * View (month/YTD), period and optional category/department filters.
 * State lives in the URL, so every view can be bookmarked and shared.
 */
export function FilterBar({ state, periods, categories, departments }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const navigate = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...state, ...patch })) {
      if (value !== null && value !== ALL) params.set(key, value);
    }
    startTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2 transition-opacity", pending && "opacity-60")}>
      <div className="inline-flex rounded-lg border bg-card p-0.5" role="group" aria-label="View">
        {(["month", "ytd"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => navigate({ view: v })}
            aria-pressed={state.view === v}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium transition-colors",
              state.view === v ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {v === "month" ? "Month" : "Year to date"}
          </button>
        ))}
      </div>

      <FilterSelect
        label="Period"
        icon={CalendarDays}
        options={periods}
        value={state.period ?? periods[0]?.value ?? ""}
        onChange={(period) => navigate({ period })}
      />
      {categories && (
        <FilterSelect
          label="Category"
          icon={Tag}
          options={[{ value: ALL, label: "All categories" }, ...categories]}
          value={state.category ?? ALL}
          onChange={(category) => navigate({ category })}
        />
      )}
      {departments && (
        <FilterSelect
          label="Department"
          icon={Building2}
          options={[{ value: ALL, label: "All departments" }, ...departments]}
          value={state.department ?? ALL}
          onChange={(department) => navigate({ department })}
        />
      )}
    </div>
  );
}

function FilterSelect({
  label,
  icon: Icon,
  options,
  value,
  onChange,
}: {
  label: string;
  icon: LucideIcon;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      items={options}
      value={value}
      onValueChange={(v) => {
        if (typeof v === "string") onChange(v);
      }}
    >
      <SelectTrigger className="min-w-40 bg-card" aria-label={label}>
        <Icon className="size-4 text-muted-foreground" aria-hidden />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

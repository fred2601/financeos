import { PERIOD_REGEX, type Period } from "@/lib/data/schema";

/**
 * Period helpers. A period is an ISO year-month string ("2025-10").
 * Fiscal year = calendar year.
 */

export function isPeriod(value: unknown): value is Period {
  return typeof value === "string" && PERIOD_REGEX.test(value);
}

export function parsePeriod(period: Period): { year: number; month: number } {
  if (!isPeriod(period)) throw new Error(`Invalid period: ${String(period)}`);
  const [year, month] = period.split("-").map(Number);
  return { year, month };
}

export function toPeriod(year: number, month: number): Period {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Shift a period by n months (n may be negative). */
export function addMonths(period: Period, n: number): Period {
  const { year, month } = parsePeriod(period);
  const index = year * 12 + (month - 1) + n;
  return toPeriod(Math.floor(index / 12), (index % 12) + 1);
}

export function previousPeriod(period: Period): Period {
  return addMonths(period, -1);
}

export function sameMonthLastYear(period: Period): Period {
  return addMonths(period, -12);
}

/** Inclusive list of periods from `from` to `to`. Empty if from > to. */
export function periodRange(from: Period, to: Period): Period[] {
  const result: Period[] = [];
  let current = from;
  while (current <= to) {
    result.push(current);
    current = addMonths(current, 1);
  }
  return result;
}

/** January of the period's fiscal year up to and including the period. */
export function ytdPeriods(period: Period): Period[] {
  const { year } = parsePeriod(period);
  return periodRange(toPeriod(year, 1), period);
}

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "Oct 2025" */
export function periodLabel(period: Period): string {
  const { year, month } = parsePeriod(period);
  return `${MONTHS_SHORT[month - 1]} ${year}`;
}

/** "Oct 25" — compact label for chart axes. */
export function periodShortLabel(period: Period): string {
  const { year, month } = parsePeriod(period);
  return `${MONTHS_SHORT[month - 1]} ${String(year).slice(2)}`;
}

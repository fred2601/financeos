import { getAccount } from "@/lib/data/chart-of-accounts";
import type {
  AccountType,
  CategoryId,
  ChannelId,
  DepartmentId,
  FinancialRecord,
  Period,
  Scenario,
} from "@/lib/data/schema";
import type { Maybe } from "./safe-math";

export interface RecordFilter {
  scenario: Scenario;
  periods: readonly Period[];
  accountTypes?: readonly AccountType[];
  accountIds?: readonly string[];
  category?: CategoryId;
  channel?: ChannelId;
  department?: DepartmentId;
}

export function filterRecords(
  records: readonly FinancialRecord[],
  filter: RecordFilter,
): FinancialRecord[] {
  const periods = new Set(filter.periods);
  return records.filter((r) => {
    if (r.scenario !== filter.scenario || !periods.has(r.period)) return false;
    if (filter.accountIds && !filter.accountIds.includes(r.accountId)) return false;
    if (filter.accountTypes) {
      const type = getAccount(r.accountId)?.type;
      if (!type || !filter.accountTypes.includes(type)) return false;
    }
    if (filter.category && r.category !== filter.category) return false;
    if (filter.channel && r.channel !== filter.channel) return false;
    if (filter.department && r.department !== filter.department) return false;
    return true;
  });
}

/** Sum of amountDkk for matching rows, or null when no rows match (= data missing). */
export function sumAmount(records: readonly FinancialRecord[], filter: RecordFilter): Maybe {
  const rows = filterRecords(records, filter);
  if (rows.length === 0) return null;
  return rows.reduce((total, r) => total + r.amountDkk, 0);
}

/** Sum of units for matching revenue rows, or null if none match or any row lacks units. */
export function sumUnits(records: readonly FinancialRecord[], filter: RecordFilter): Maybe {
  const rows = filterRecords(records, { ...filter, accountTypes: ["revenue"] });
  if (rows.length === 0) return null;
  let total = 0;
  for (const r of rows) {
    if (r.units === null) return null;
    total += r.units;
  }
  return total;
}

/** The raw P&L building blocks for one scenario and a set of periods. */
export interface PnlInputs {
  revenue: Maybe;
  cogs: Maybe;
  opex: Maybe;
  da: Maybe;
  units: Maybe;
}

export function pnlInputs(
  records: readonly FinancialRecord[],
  filter: Omit<RecordFilter, "accountTypes" | "accountIds">,
): PnlInputs {
  const by = (type: AccountType) => sumAmount(records, { ...filter, accountTypes: [type] });
  return {
    revenue: by("revenue"),
    cogs: by("cogs"),
    opex: by("opex"),
    da: by("da"),
    units: sumUnits(records, filter),
  };
}

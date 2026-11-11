import type { AccountType } from "./schema";

/**
 * Whether a higher value is good or bad for the business.
 * This — not the mathematical sign — decides favorable vs unfavorable.
 */
export type Direction = "higher-is-better" | "lower-is-better";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
}

export const ACCOUNTS = [
  { id: "REV", name: "Revenue", type: "revenue" },
  { id: "COGS", name: "Cost of goods sold", type: "cogs" },
  { id: "OPEX_PERSONNEL", name: "Personnel costs", type: "opex" },
  { id: "OPEX_RENT", name: "Rent & facilities", type: "opex" },
  { id: "OPEX_MARKETING", name: "Marketing", type: "opex" },
  { id: "OPEX_LOGISTICS", name: "Logistics & freight", type: "opex" },
  { id: "OPEX_IT", name: "IT & software", type: "opex" },
  { id: "OPEX_OTHER", name: "Other operating expenses", type: "opex" },
  { id: "DA", name: "Depreciation & amortisation", type: "da" },
] as const satisfies readonly Account[];

export type AccountId = (typeof ACCOUNTS)[number]["id"];

const ACCOUNT_BY_ID = new Map<string, Account>(ACCOUNTS.map((a) => [a.id, a]));

export function getAccount(id: string): Account | undefined {
  return ACCOUNT_BY_ID.get(id);
}

export function isKnownAccount(id: string): boolean {
  return ACCOUNT_BY_ID.has(id);
}

export const ACCOUNT_TYPE_DIRECTION: Record<AccountType, Direction> = {
  revenue: "higher-is-better",
  cogs: "lower-is-better",
  opex: "lower-is-better",
  da: "lower-is-better",
};

export function accountDirection(id: string): Direction | undefined {
  const account = getAccount(id);
  return account ? ACCOUNT_TYPE_DIRECTION[account.type] : undefined;
}

import { z } from "zod";

/**
 * Data schema for FinanceOS.
 *
 * The dataset is a "long" fact table, shaped like a general-ledger extract:
 * one row = one amount for one account, period, scenario and dimension combination.
 * See docs/ARCHITECTURE.md §4 for the conventions (sign, units, missing values).
 */

export const CATEGORY_IDS = ["home-living", "fashion", "outdoor-sport"] as const;
export const CHANNEL_IDS = ["stores", "ecommerce"] as const;
export const DEPARTMENT_IDS = [
  "stores",
  "ecommerce",
  "marketing",
  "logistics",
  "head-office",
] as const;
export const SCENARIOS = ["actual", "budget"] as const;
export const ACCOUNT_TYPES = ["revenue", "cogs", "opex", "da"] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];
export type ChannelId = (typeof CHANNEL_IDS)[number];
export type DepartmentId = (typeof DEPARTMENT_IDS)[number];
export type Scenario = (typeof SCENARIOS)[number];
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** ISO year-month, e.g. "2025-10". */
export type Period = string;
export const PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export const periodSchema = z.string().regex(PERIOD_REGEX, "Period must be YYYY-MM");

export const financialRecordSchema = z
  .object({
    period: periodSchema,
    scenario: z.enum(SCENARIOS),
    accountId: z.string().min(1),
    category: z.enum(CATEGORY_IDS).nullable(),
    channel: z.enum(CHANNEL_IDS).nullable(),
    department: z.enum(DEPARTMENT_IDS).nullable(),
    /** Whole DKK, stored positive in the account's natural direction. */
    amountDkk: z.number().finite(),
    /** Units sold. Only set on revenue rows. */
    units: z.number().finite().nonnegative().nullable(),
  })
  .strict();

export type FinancialRecord = z.infer<typeof financialRecordSchema>;

export const datasetSchema = z
  .object({
    meta: z.object({
      company: z.string(),
      fictional: z.literal(true),
      currency: z.literal("DKK"),
      description: z.string(),
      firstPeriod: periodSchema,
      lastPeriod: periodSchema,
      generator: z.string(),
    }),
    records: z.array(financialRecordSchema).min(1),
  })
  .strict();

export type Dataset = z.infer<typeof datasetSchema>;

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  "home-living": "Home & Living",
  fashion: "Fashion",
  "outdoor-sport": "Outdoor & Sport",
};

export const CHANNEL_LABELS: Record<ChannelId, string> = {
  stores: "Stores",
  ecommerce: "E-commerce",
};

export const DEPARTMENT_LABELS: Record<DepartmentId, string> = {
  stores: "Stores",
  ecommerce: "E-commerce",
  marketing: "Marketing",
  logistics: "Logistics",
  "head-office": "Head office",
};

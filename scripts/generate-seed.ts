/**
 * Generates the FICTIONAL dataset for "Fjordhus Retail A/S".
 *
 * Deterministic: a seeded random generator means every run produces exactly
 * the same file. Run with `npm run seed`.
 *
 * How the numbers are built (see docs/DATA.md for the full storyline):
 *  1. Budget  = baseline plan: units × ASP per category/channel/month with seasonality,
 *               COGS from planned gross margins, opex per department.
 *  2. Actual  = budget × planted deviations × small random noise.
 * Revenue is always computed as units × ASP, so the identity holds by construction.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CATEGORY_IDS,
  CHANNEL_IDS,
  datasetSchema,
  type CategoryId,
  type ChannelId,
  type DepartmentId,
  type Dataset,
  type FinancialRecord,
  type Period,
  type Scenario,
} from "../src/lib/data/schema";
import { parsePeriod, periodRange } from "../src/lib/finance/periods";

// ---------------------------------------------------------------------------
// Deterministic random numbers (mulberry32)
// ---------------------------------------------------------------------------
function createRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = createRng(20260111);
/** Multiplicative noise, e.g. noise(0.02) → between 0.98 and 1.02. */
const noise = (pct: number) => 1 + (rng() * 2 - 1) * pct;

// ---------------------------------------------------------------------------
// Assumptions
// ---------------------------------------------------------------------------
const FIRST_PERIOD = "2024-01";
const LAST_PERIOD = "2025-12";
const PERIODS = periodRange(FIRST_PERIOD, LAST_PERIOD);

interface CategoryPlan {
  annualUnits2024: number;
  asp2024: number; // DKK, stores channel
  grossMargin: number; // planned gross margin
  seasonality: number[]; // 12 monthly weights, normalised below
}

const CATEGORY_PLAN: Record<CategoryId, CategoryPlan> = {
  "home-living": {
    annualUnits2024: 450_000,
    asp2024: 420,
    grossMargin: 0.52,
    seasonality: [0.75, 0.7, 0.8, 0.85, 0.85, 0.8, 0.75, 0.85, 0.95, 1.05, 1.6, 2.05],
  },
  fashion: {
    annualUnits2024: 455_000,
    asp2024: 310,
    grossMargin: 0.58,
    seasonality: [0.8, 0.7, 0.9, 1.0, 1.05, 0.95, 0.85, 0.95, 1.05, 1.0, 1.25, 1.5],
  },
  "outdoor-sport": {
    annualUnits2024: 180_000,
    asp2024: 560,
    grossMargin: 0.46,
    seasonality: [0.55, 0.6, 0.85, 1.1, 1.35, 1.6, 1.55, 1.2, 0.9, 0.75, 0.7, 0.85],
  },
};

/** Share of units sold online, by fiscal year (budget). */
const ECOMMERCE_SHARE: Record<number, number> = { 2024: 0.28, 2025: 0.31 };
/** Online prices are slightly lower than in stores. */
const ECOMMERCE_ASP_FACTOR = 0.97;
/** Budgeted volume growth and price inflation vs 2024. */
const UNIT_GROWTH: Record<number, number> = { 2024: 1, 2025: 1.05 };
const PRICE_INDEX: Record<number, number> = { 2024: 1, 2025: 1.03 };
/** Sales-driven price effects: January sale, Black Friday in November. */
const MONTH_PRICE_FACTOR: Record<number, number> = { 1: 0.88, 11: 0.94 };
/** Discounted months also carry a lower gross margin (percentage points). */
const MONTH_MARGIN_DELTA: Record<number, number> = { 1: -0.04, 11: -0.02 };

/** Annual budget in DKK per opex account and department (2024). */
type OpexLine = {
  accountId: string;
  department: DepartmentId;
  annual2024: number;
  /** Share that moves with revenue seasonality (0 = fully fixed). */
  variableShare: number;
  /** Optional fixed monthly weights instead of revenue seasonality. */
  weights?: number[];
  /** Budgeted growth 2025 vs 2024. */
  growth2025: number;
};

const OPEX_LINES: OpexLine[] = [
  { accountId: "OPEX_PERSONNEL", department: "stores", annual2024: 70_000_000, variableShare: 0.3, growth2025: 1.03 },
  { accountId: "OPEX_PERSONNEL", department: "ecommerce", annual2024: 10_000_000, variableShare: 0.2, growth2025: 1.08 },
  { accountId: "OPEX_PERSONNEL", department: "marketing", annual2024: 6_000_000, variableShare: 0, growth2025: 1.03 },
  { accountId: "OPEX_PERSONNEL", department: "logistics", annual2024: 14_000_000, variableShare: 0.35, growth2025: 1.03 },
  { accountId: "OPEX_PERSONNEL", department: "head-office", annual2024: 22_000_000, variableShare: 0, growth2025: 1.03 },
  { accountId: "OPEX_RENT", department: "stores", annual2024: 32_000_000, variableShare: 0, growth2025: 1.02 },
  { accountId: "OPEX_RENT", department: "logistics", annual2024: 6_000_000, variableShare: 0, growth2025: 1.02 },
  { accountId: "OPEX_RENT", department: "head-office", annual2024: 4_000_000, variableShare: 0, growth2025: 1.02 },
  {
    accountId: "OPEX_MARKETING",
    department: "marketing",
    annual2024: 14_000_000,
    variableShare: 0,
    weights: [0.8, 0.7, 0.9, 0.95, 1.0, 0.85, 0.7, 0.9, 1.0, 1.0, 1.8, 1.4],
    growth2025: 1.05,
  },
  { accountId: "OPEX_LOGISTICS", department: "logistics", annual2024: 7_800_000, variableShare: 0.8, growth2025: 1.06 },
  { accountId: "OPEX_IT", department: "head-office", annual2024: 5_000_000, variableShare: 0, growth2025: 1.04 },
  { accountId: "OPEX_IT", department: "ecommerce", annual2024: 3_000_000, variableShare: 0, growth2025: 1.08 },
  { accountId: "OPEX_OTHER", department: "head-office", annual2024: 3_000_000, variableShare: 0, growth2025: 1.02 },
  { accountId: "OPEX_OTHER", department: "stores", annual2024: 2_000_000, variableShare: 0.2, growth2025: 1.02 },
  { accountId: "DA", department: "stores", annual2024: 12_000_000, variableShare: 0, growth2025: 1.0 },
  { accountId: "DA", department: "ecommerce", annual2024: 2_400_000, variableShare: 0, growth2025: 1.1 },
  { accountId: "DA", department: "head-office", annual2024: 3_600_000, variableShare: 0, growth2025: 1.0 },
];

// ---------------------------------------------------------------------------
// Planted deviations (actual vs budget). Documented in docs/DATA.md.
// ---------------------------------------------------------------------------
function unitDeviation(period: Period, category: CategoryId, channel: ChannelId): number {
  const { year, month } = parsePeriod(period);
  let f = 1;
  // A. Fashion spring 2025: volumes well below plan.
  if (category === "fashion" && year === 2025 && month >= 3 && month <= 5) f *= 0.86;
  // B. E-commerce outperforms throughout 2025, ramping up during the year.
  if (channel === "ecommerce" && year === 2025) f *= 1 + 0.04 + 0.007 * month;
  // C. Outdoor & Sport: weak summer 2024, strong summer 2025.
  if (category === "outdoor-sport" && year === 2024 && (month === 6 || month === 7)) f *= 0.88;
  if (category === "outdoor-sport" && year === 2025 && month >= 5 && month <= 7) f *= 1.07;
  // D. Home & Living: strong Christmas 2025.
  if (category === "home-living" && year === 2025 && month >= 11) f *= 1.08;
  return f;
}

function priceDeviation(period: Period, category: CategoryId): number {
  const { year, month } = parsePeriod(period);
  // A. Fashion spring 2025: extra markdowns.
  if (category === "fashion" && year === 2025 && month >= 3 && month <= 5) return 0.95;
  return 1;
}

function marginDeviation(period: Period, category: CategoryId): number {
  const { year, month } = parsePeriod(period);
  let d = 0;
  // A. Fashion spring 2025: markdowns reduce gross margin.
  if (category === "fashion" && year === 2025 && month >= 3 && month <= 5) d -= 0.035;
  // E. Home & Living: higher purchase prices in H2 2024.
  if (category === "home-living" && year === 2024 && month >= 7) d -= 0.015;
  return d;
}

function opexDeviation(period: Period, line: OpexLine): number {
  const { year, month } = parsePeriod(period);
  const { accountId, department } = line;
  // F. Freight rates above plan in H2 2024.
  if (accountId === "OPEX_LOGISTICS" && year === 2024 && month >= 7) return 1.18;
  // G. Marketing overspend around Black Friday 2025.
  if (accountId === "OPEX_MARKETING" && year === 2025 && month === 11) return 1.35;
  // H. Store overtime in December 2024.
  if (accountId === "OPEX_PERSONNEL" && department === "stores" && year === 2024 && month === 12) return 1.06;
  // I. New IT platform in 2025 (head office).
  if (accountId === "OPEX_IT" && department === "head-office" && year === 2025) return 1.1;
  // J. Cost discipline on other opex.
  if (accountId === "OPEX_OTHER") return 0.95;
  return 1;
}

// ---------------------------------------------------------------------------
// Build records
// ---------------------------------------------------------------------------
const normalise = (weights: number[]) => {
  const total = weights.reduce((s, w) => s + w, 0);
  return weights.map((w) => (w * 12) / total);
};

const COMPANY_SEASONALITY = normalise(
  Array.from({ length: 12 }, (_, i) =>
    CATEGORY_IDS.reduce((s, c) => {
      const p = CATEGORY_PLAN[c];
      return s + normalise(p.seasonality)[i] * p.annualUnits2024 * p.asp2024;
    }, 0),
  ),
);

const records: FinancialRecord[] = [];

function push(
  r: Omit<FinancialRecord, "category" | "channel" | "department" | "units"> &
    Partial<Pick<FinancialRecord, "category" | "channel" | "department" | "units">>,
) {
  records.push({
    category: null,
    channel: null,
    department: null,
    units: null,
    ...r,
  });
}

for (const period of PERIODS) {
  const { year, month } = parsePeriod(period);

  for (const scenario of ["budget", "actual"] as Scenario[]) {
    const isActual = scenario === "actual";

    // Revenue + COGS per category and channel
    for (const category of CATEGORY_IDS) {
      const plan = CATEGORY_PLAN[category];
      const season = normalise(plan.seasonality)[month - 1];
      for (const channel of CHANNEL_IDS) {
        const share = channel === "ecommerce" ? ECOMMERCE_SHARE[year] : 1 - ECOMMERCE_SHARE[year];
        let units = (plan.annualUnits2024 / 12) * season * share * UNIT_GROWTH[year];
        let asp =
          plan.asp2024 *
          PRICE_INDEX[year] *
          (MONTH_PRICE_FACTOR[month] ?? 1) *
          (channel === "ecommerce" ? ECOMMERCE_ASP_FACTOR : 1);
        let margin = plan.grossMargin + (MONTH_MARGIN_DELTA[month] ?? 0);

        if (isActual) {
          units *= unitDeviation(period, category, channel) * noise(0.03);
          asp *= priceDeviation(period, category) * noise(0.01);
          margin += marginDeviation(period, category) + (rng() * 2 - 1) * 0.005;
        }

        const roundedUnits = Math.round(units);
        const revenue = Math.round(roundedUnits * asp); // Revenue = units × ASP
        const cogs = Math.round(revenue * (1 - margin));

        push({ period, scenario, accountId: "REV", category, channel, amountDkk: revenue, units: roundedUnits });
        push({ period, scenario, accountId: "COGS", category, channel, amountDkk: cogs });
      }
    }

    // Opex and D&A per department
    for (const line of OPEX_LINES) {
      const weights = line.weights ? normalise(line.weights) : COMPANY_SEASONALITY;
      const seasonal = line.weights ? weights[month - 1] : 1 - line.variableShare + line.variableShare * weights[month - 1];
      let amount = (line.annual2024 / 12) * seasonal * (year === 2025 ? line.growth2025 : 1);
      if (isActual) {
        amount *= opexDeviation(period, line) * (line.accountId === "DA" ? 1 : noise(0.02));
      }
      push({ period, scenario, accountId: line.accountId, department: line.department, amountDkk: Math.round(amount) });
    }
  }
}

const dataset: Dataset = {
  meta: {
    company: "Fjordhus Retail A/S",
    fictional: true,
    currency: "DKK",
    description:
      "FICTIONAL demo data for a Danish omnichannel home & lifestyle retailer. Not a real company.",
    firstPeriod: FIRST_PERIOD,
    lastPeriod: LAST_PERIOD,
    generator: "scripts/generate-seed.ts (seed 20260111)",
  },
  records,
};

// Validate before writing, so a broken generator can never produce a broken file.
datasetSchema.parse(dataset);

const here = dirname(fileURLToPath(import.meta.url));
const outFile = resolve(here, "../src/data/seed/fjordhus-2024-2025.json");
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(dataset) + "\n");
console.log(`Wrote ${records.length} records to ${outFile}`);

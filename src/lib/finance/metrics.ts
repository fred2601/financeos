import type { PnlInputs } from "./aggregate";
import { safeDivide, safeSubtract, type Maybe } from "./safe-math";

/** Revenue = units sold × average selling price. */
export function revenueFromDrivers(units: Maybe, averageSellingPrice: Maybe): Maybe {
  if (units === null || averageSellingPrice === null) return null;
  return units * averageSellingPrice;
}

/** Average selling price = revenue / units. */
export function averageSellingPrice(revenue: Maybe, units: Maybe): Maybe {
  return safeDivide(revenue, units);
}

/** Gross profit = revenue − COGS. */
export function grossProfit(revenue: Maybe, cogs: Maybe): Maybe {
  return safeSubtract(revenue, cogs);
}

/** EBITDA = gross profit − operating expenses (depreciation & amortisation excluded). */
export function ebitda(grossProfitValue: Maybe, operatingExpenses: Maybe): Maybe {
  return safeSubtract(grossProfitValue, operatingExpenses);
}

/**
 * Margin = value / revenue. Not meaningful when revenue is zero or negative,
 * so we return null rather than a misleading percentage.
 */
export function margin(value: Maybe, revenue: Maybe): Maybe {
  if (revenue === null || revenue <= 0) return null;
  return safeDivide(value, revenue);
}

export interface PnlMetrics {
  revenue: Maybe;
  units: Maybe;
  averageSellingPrice: Maybe;
  cogs: Maybe;
  grossProfit: Maybe;
  grossMargin: Maybe;
  opex: Maybe;
  ebitda: Maybe;
  ebitdaMargin: Maybe;
  /** Memo line only: shown to make clear it is NOT part of EBITDA. */
  da: Maybe;
}

export function computeMetrics(inputs: PnlInputs): PnlMetrics {
  const gp = grossProfit(inputs.revenue, inputs.cogs);
  const e = ebitda(gp, inputs.opex);
  return {
    revenue: inputs.revenue,
    units: inputs.units,
    averageSellingPrice: averageSellingPrice(inputs.revenue, inputs.units),
    cogs: inputs.cogs,
    grossProfit: gp,
    grossMargin: margin(gp, inputs.revenue),
    opex: inputs.opex,
    ebitda: e,
    ebitdaMargin: margin(e, inputs.revenue),
    da: inputs.da,
  };
}

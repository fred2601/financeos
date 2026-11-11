/**
 * Null-aware arithmetic. `null` means "missing / not meaningful" and propagates,
 * so a missing input never silently turns into a misleading 0.
 */

export type Maybe = number | null;

const isNum = (v: Maybe | undefined): v is number =>
  typeof v === "number" && Number.isFinite(v);

/** a / b, or null when either is missing, b is 0, or the result is not finite. */
export function safeDivide(numerator: Maybe, denominator: Maybe): Maybe {
  if (!isNum(numerator) || !isNum(denominator) || denominator === 0) return null;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : null;
}

/** a − b, or null when either is missing. */
export function safeSubtract(a: Maybe, b: Maybe): Maybe {
  return isNum(a) && isNum(b) ? a - b : null;
}

/**
 * Sum of values. Returns null for an empty list or if any value is missing
 * (a total with a hole in it is not a reliable total).
 */
export function sumStrict(values: readonly Maybe[]): Maybe {
  if (values.length === 0) return null;
  let total = 0;
  for (const v of values) {
    if (!isNum(v)) return null;
    total += v;
  }
  return total;
}

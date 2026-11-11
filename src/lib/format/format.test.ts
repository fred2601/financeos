import { describe, expect, it } from "vitest";
import { formatDkk, formatNumber, formatPercent, formatPp } from "./index";

// Intl may use non-breaking spaces; normalise for readable assertions.
const n = (s: string) => s.replace(/[  ]/g, " ");

describe("format", () => {
  it("formats DKK with Danish separators and auto scale", () => {
    expect(n(formatDkk(12_345_678))).toBe("12,3 mio. kr.");
    expect(n(formatDkk(456_789))).toBe("457 t.kr.");
    expect(n(formatDkk(950))).toBe("950 kr.");
    expect(n(formatDkk(1_234_567, { scale: "kr" }))).toBe("1.234.567 kr.");
  });
  it("formats negatives with a minus and optional plus sign", () => {
    expect(n(formatDkk(-2_500_000))).toBe("−2,5 mio. kr.");
    expect(n(formatDkk(2_500_000, { signed: true }))).toBe("+2,5 mio. kr.");
  });
  it("formats percentages and percentage points", () => {
    expect(n(formatPercent(0.1234))).toBe("12,3 %");
    expect(n(formatPercent(-0.05, { signed: true }))).toBe("−5,0 %");
    expect(n(formatPp(0.012))).toBe("+1,2 pp");
    expect(n(formatPp(-0.0004))).toBe("0,0 pp");
  });
  it("shows n/a for missing values", () => {
    expect(formatDkk(null)).toBe("n/a");
    expect(formatPercent(null)).toBe("n/a");
    expect(formatPp(null)).toBe("n/a");
    expect(formatNumber(Number.NaN)).toBe("n/a");
  });
});

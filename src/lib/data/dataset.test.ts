import { describe, expect, it } from "vitest";
import { pnlInputs } from "@/lib/finance/aggregate";
import { computeMetrics } from "@/lib/finance/metrics";
import { periodRange } from "@/lib/finance/periods";
import { isKnownAccount } from "./chart-of-accounts";
import { getDataset } from "./dataset";
import { CATEGORY_IDS, CHANNEL_IDS, SCENARIOS } from "./schema";

/** Data-integrity tests: the fictional dataset must obey our accounting rules. */
describe("fictional seed dataset", () => {
  const dataset = getDataset();
  const { records, meta } = dataset;
  const periods = periodRange(meta.firstPeriod, meta.lastPeriod);

  it("is labelled fictional and covers 24 months", () => {
    expect(meta.fictional).toBe(true);
    expect(periods).toHaveLength(24);
  });

  it("has revenue and COGS for every period, scenario, category and channel", () => {
    for (const period of periods)
      for (const scenario of SCENARIOS)
        for (const category of CATEGORY_IDS)
          for (const channel of CHANNEL_IDS)
            for (const accountId of ["REV", "COGS"]) {
              const hits = records.filter(
                (r) =>
                  r.period === period && r.scenario === scenario && r.accountId === accountId &&
                  r.category === category && r.channel === channel,
              );
              expect(hits, `${period} ${scenario} ${accountId} ${category} ${channel}`).toHaveLength(1);
            }
  });

  it("uses only known accounts and finite amounts", () => {
    for (const r of records) {
      expect(isKnownAccount(r.accountId)).toBe(true);
      expect(Number.isFinite(r.amountDkk)).toBe(true);
    }
  });

  it("has units on every revenue row and nowhere else, with a plausible ASP", () => {
    for (const r of records) {
      if (r.accountId === "REV") {
        expect(r.units).not.toBeNull();
        const asp = r.amountDkk / (r.units ?? 1);
        expect(asp).toBeGreaterThan(150);
        expect(asp).toBeLessThan(800);
      } else {
        expect(r.units).toBeNull();
      }
    }
  });

  it("uses the right dimensions per account type", () => {
    for (const r of records) {
      const isSales = r.accountId === "REV" || r.accountId === "COGS";
      expect(r.category !== null, r.accountId).toBe(isSales);
      expect(r.channel !== null).toBe(isSales);
      expect(r.department !== null).toBe(!isSales);
    }
  });

  it("produces plausible annual margins for a Danish retailer", () => {
    for (const scenario of SCENARIOS)
      for (const year of [2024, 2025]) {
        const m = computeMetrics(
          pnlInputs(records, { scenario, periods: periodRange(`${year}-01`, `${year}-12`) }),
        );
        expect(m.grossMargin).toBeGreaterThan(0.45);
        expect(m.grossMargin).toBeLessThan(0.6);
        expect(m.ebitdaMargin).toBeGreaterThan(0.02);
        expect(m.ebitdaMargin).toBeLessThan(0.12);
      }
  });
});

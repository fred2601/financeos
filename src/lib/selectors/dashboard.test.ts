import { describe, expect, it } from "vitest";
import { getDataset } from "@/lib/data/dataset";
import { buildDashboard } from "./dashboard";

const dataset = getDataset();
const sum = (period: string | string[], scenario: string, accountIds: string[]) => {
  const periods = Array.isArray(period) ? period : [period];
  return dataset.records
    .filter((r) => periods.includes(r.period) && r.scenario === scenario && accountIds.includes(r.accountId))
    .reduce((s, r) => s + r.amountDkk, 0);
};
const OPEX = ["OPEX_PERSONNEL", "OPEX_RENT", "OPEX_MARKETING", "OPEX_LOGISTICS", "OPEX_IT", "OPEX_OTHER"];

describe("dashboard view-model", () => {
  it("defaults to the latest period and month view for invalid input", () => {
    const vm = buildDashboard(dataset, { period: "1999-01", view: "nonsense" });
    expect(vm.period).toBe("2025-12");
    expect(vm.view).toBe("month");
  });

  it("matches a hand calculation from raw records (Oct 2025)", () => {
    const vm = buildDashboard(dataset, { period: "2025-10", view: "month" });
    const revenue = sum("2025-10", "actual", ["REV"]);
    const ebitda = revenue - sum("2025-10", "actual", ["COGS"]) - sum("2025-10", "actual", OPEX);
    const kpi = (k: string) => vm.kpis.find((x) => x.key === k);
    expect(kpi("revenue")?.actual).toBe(revenue);
    expect(kpi("ebitda")?.actual).toBe(ebitda);
    expect(kpi("revenue")?.vsBudget.absolute).toBe(revenue - sum("2025-10", "budget", ["REV"]));
  });

  it("YTD view sums January to the selected month and compares with prior-year YTD", () => {
    const vm = buildDashboard(dataset, { period: "2025-03", view: "ytd" });
    const ytd = ["2025-01", "2025-02", "2025-03"];
    const priorYtd = ["2024-01", "2024-02", "2024-03"];
    const rev = vm.kpis.find((k) => k.key === "revenue");
    expect(rev?.actual).toBe(sum(ytd, "actual", ["REV"]));
    expect(rev?.vsPrior.reference).toBe(sum(priorYtd, "actual", ["REV"]));
  });

  it("shows n/a (null) comparisons when no prior period exists", () => {
    const vm = buildDashboard(dataset, { period: "2024-01", view: "month" });
    const rev = vm.kpis.find((k) => k.key === "revenue");
    expect(rev?.vsPrior.reference).toBeNull();
    expect(rev?.vsPrior.percent).toBeNull();
    expect(rev?.vsPrior.status).toBe("neutral");
  });

  it("category revenue adds up to the total", () => {
    const vm = buildDashboard(dataset, { period: "2025-06", view: "ytd" });
    const total = vm.categories.find((c) => c.id === "total");
    const parts = vm.categories.filter((c) => c.id !== "total").reduce((s, c) => s + (c.revenue.actual ?? 0), 0);
    expect(parts).toBe(total?.revenue.actual);
  });

  it("flags the planted marketing overspend in Nov 2025 as unfavorable opex", () => {
    const vm = buildDashboard(dataset, { period: "2025-11", view: "month" });
    const opex = vm.pnl.find((r) => r.key === "opex");
    expect(opex?.comparison.status).toBe("unfavorable");
  });
});

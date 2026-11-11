import { describe, expect, it } from "vitest";
import { getDataset } from "@/lib/data/dataset";
import { buildVariance } from "./variance";

const dataset = getDataset();

describe("variance view-model", () => {
  it("ignores invalid filter values", () => {
    const vm = buildVariance(dataset, { category: "toys", department: 42 });
    expect(vm.filters.category).toBeNull();
    expect(vm.filters.department).toBeNull();
    expect(vm.filtersActive).toBe(false);
  });

  it("EBITDA bridge starts at budget, ends at actual and every step closes", () => {
    const vm = buildVariance(dataset, { period: "2025-11", view: "ytd" });
    const bridge = vm.bridge;
    expect(bridge).not.toBeNull();
    if (!bridge) return;
    const first = bridge[0];
    const last = bridge[bridge.length - 1];
    const ebitda = vm.summary.find((s) => s.key === "ebitda")?.comparison;
    expect(first.value).toBe(ebitda?.reference);
    expect(last.value).toBe(ebitda?.actual);
    const moves = bridge.slice(1, -1).reduce((s, b) => s + b.value, 0);
    expect(first.value + moves).toBeCloseTo(last.value, 4);
  });

  it("price/volume/mix adds up to the revenue variance", () => {
    const vm = buildVariance(dataset, { period: "2025-05", view: "ytd" });
    const pvm = vm.pvm;
    expect(pvm).not.toBeNull();
    if (!pvm) return;
    expect(pvm.volume + pvm.mix + pvm.price).toBeCloseTo(vm.revenueTotal.revenue.absolute ?? NaN, 4);
    const rowsTotal = vm.revenueRows.reduce((s, r) => s + (r.volumeEffect ?? 0) + (r.priceEffect ?? 0), 0);
    expect(rowsTotal).toBeCloseTo(pvm.total, 4);
  });

  it("finds the planted Fashion shortfall in spring 2025 (lower price and volume)", () => {
    const vm = buildVariance(dataset, { period: "2025-04", view: "month", category: "fashion" });
    const rev = vm.summary.find((s) => s.key === "revenue")?.comparison;
    expect(rev?.status).toBe("unfavorable");
    for (const r of vm.revenueRows) {
      expect(r.volumeEffect ?? 0).toBeLessThan(0);
      expect(r.priceEffect ?? 0).toBeLessThan(0);
    }
  });

  it("ranks the planted Nov 2025 marketing overspend as the largest cost driver", () => {
    const vm = buildVariance(dataset, { period: "2025-11", view: "month", department: "marketing" });
    const top = vm.drivers[0];
    expect(top.key).toBe("opex|marketing|OPEX_MARKETING");
    expect(top.comparison.status).toBe("unfavorable");
    expect(top.ebitdaImpact).toBeLessThan(0);
  });

  it("department filter limits cost groups and hides the company EBITDA row", () => {
    const vm = buildVariance(dataset, { period: "2025-06", department: "logistics" });
    expect(vm.costGroups.map((g) => g.department)).toEqual(["logistics"]);
    expect(vm.accounts.some((a) => a.key === "EBITDA")).toBe(false);
    const groupSum = vm.costGroups[0].lines.reduce((s, l) => s + (l.comparison.actual ?? 0), 0);
    expect(groupSum).toBe(vm.costTotal.actual);
  });

  it("cost groups add up to total operating expenses when unfiltered", () => {
    const vm = buildVariance(dataset, { period: "2024-12", view: "ytd" });
    const total = vm.costGroups.reduce((s, g) => s + (g.subtotal.actual ?? 0), 0);
    expect(total).toBe(vm.costTotal.actual);
  });
});

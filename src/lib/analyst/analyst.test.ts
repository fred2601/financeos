import { describe, expect, it } from "vitest";
import { getDataset } from "@/lib/data/dataset";
import { buildFactSheet, type Fact } from "./fact-sheet";
import { checkStatement, validateAnalysis, type AnalystOutput } from "./output";
import { ANALYST_SYSTEM_PROMPT, buildUserMessage } from "./prompt";

const dataset = getDataset();
const sheet = buildFactSheet(dataset, { period: "2025-11", view: "ytd" });
const byId = new Map<string, Fact>(sheet.facts.map((f) => [f.id, f]));
const find = (label: string) => sheet.facts.find((f) => f.label.startsWith(label));

describe("fact sheet", () => {
  it("has unique sequential ids and only formatted, aggregated values", () => {
    expect(new Set(sheet.facts.map((f) => f.id)).size).toBe(sheet.facts.length);
    sheet.facts.forEach((f, i) => expect(f.id).toBe(`F${i + 1}`));
    expect(sheet.facts.length).toBeGreaterThan(20);
    expect(sheet.facts.length).toBeLessThan(80);
  });

  it("uses the app's own validated numbers (YTD Nov 2025 revenue +6,7 mio. kr. vs budget)", () => {
    expect(find("Period analysed")?.value).toBe("YTD Jan 2025 – Nov 2025");
    const rev = find("Revenue — variance vs budget");
    expect(rev?.value.replace(/ /g, " ")).toMatch(/^\+6,7 mio\. kr\. \(\+1,7 %\)$/);
    expect(rev?.status).toBe("favorable");
    expect(find("Revenue variance from mix")?.status).toBe("favorable");
    expect(find("Revenue variance from selling price")?.status).toBe("unfavorable");
  });

  it("carries the app's favorability, including 'on budget' for immaterial variances", () => {
    expect(find("Operating expenses — variance vs budget")?.status).toBe("on budget"); // +0,3 %
  });

  it("marks prior-period comparisons as not applicable when there is no prior period", () => {
    const jan = buildFactSheet(dataset, { period: "2024-01", view: "month" });
    const prior = jan.facts.find((f) => f.label.startsWith("Revenue — change"));
    expect(prior?.status).toBe("not applicable");
    expect(prior?.value).toContain("n/a");
  });

  it("user message lists every fact and nothing else numeric", () => {
    const msg = buildUserMessage(sheet);
    for (const f of sheet.facts) expect(msg).toContain(`${f.id} | ${f.label} | ${f.value} | ${f.status}`);
    expect(msg).toContain("fictional demo data");
    expect(msg).not.toMatch(/amountDkk|accountId|"scenario"/); // no raw ledger records
  });

  it("system prompt is static (cacheable) and states the core rules", () => {
    expect(ANALYST_SYSTEM_PROMPT).not.toMatch(/\d{4}-\d{2}/);
    expect(ANALYST_SYSTEM_PROMPT).toMatch(/never write digits/i);
    expect(ANALYST_SYSTEM_PROMPT).toMatch(/not evidence that one caused/i);
  });
});

describe("statement validation", () => {
  it("resolves placeholders to fact values", () => {
    const r = checkStatement("Revenue was {{F3}} against a budget of {{F4}}.", byId, true);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.factIds).toEqual(["F3", "F4"]);
    expect(r.value.segments.filter((s) => s.type === "fact")).toHaveLength(2);
  });

  it.each([
    ["Revenue grew 5 % to {{F3}}.", "number"],
    ["Revenue was DKK 401m.", "number"],
    ["EBITDA rose by two million.", "words"],
    ["Margins fell by half a point {{F5}}.", "words"],
    ["See {{F999}}.", "unknown fact"],
    ["Revenue was {F3}.", "malformed"],
  ])("rejects %j (%s)", (text) => {
    expect(checkStatement(text, byId).ok).toBe(false);
  });

  it("requires facts to cite at least one figure", () => {
    expect(checkStatement("Revenue was ahead of budget.", byId, true).ok).toBe(false);
    expect(checkStatement("Revenue was ahead of budget.", byId, false).ok).toBe(true);
  });

  it("tolerates spaces inside placeholders", () => {
    expect(checkStatement("EBITDA {{ F5 }}.", byId, true).ok).toBe(true);
  });
});

describe("analysis validation", () => {
  const output: AnalystOutput = {
    headline: "Revenue ahead of budget, Fashion behind",
    summary: "Year to date revenue is {{F5}} versus budget.",
    facts: [
      { text: "Revenue variance is {{F5}}." },
      { text: "Revenue rose 7 %." }, // rejected: digit
      { text: "Costs were broadly in line." }, // rejected: no fact cited
    ],
    hypotheses: [
      { text: "The price effect {{F40}} may reflect markdowns.", verify: "Check markdown logs with the merchandising team." },
      { text: "Volume growth could indicate", verify: "Ask {{F999}}" }, // rejected: unknown fact in verify
    ],
    recommendations: [{ text: "Review the largest cost driver with the budget owner." }],
  };

  it("keeps valid statements, drops invalid ones and reports why", () => {
    const v = validateAnalysis(output, sheet);
    expect(v.facts).toHaveLength(1);
    expect(v.hypotheses.length).toBeLessThanOrEqual(1);
    expect(v.recommendations).toHaveLength(1);
    expect(v.rejected.map((r) => r.section)).toEqual(expect.arrayContaining(["facts", "facts", "hypotheses"]));
    expect(v.rejected.some((r) => r.reason.includes("number"))).toBe(true);
    expect(v.rejected.some((r) => r.reason.includes("does not cite"))).toBe(true);
  });

  it("never lets a rejected headline or summary through", () => {
    const v = validateAnalysis({ ...output, headline: "Revenue up 7 %", summary: "EBITDA was 20 million." }, sheet);
    expect(v.headline.segments).toEqual([{ type: "text", text: "Management summary" }]);
    expect(v.summary.factIds).toEqual([]);
    expect(v.rejected.filter((r) => r.section === "headline" || r.section === "summary")).toHaveLength(2);
  });
});

import { RateLimiter, TtlCache } from "./guards";

describe("demo guards", () => {
  it("rate limiter allows up to the limit per window", () => {
    const rl = new RateLimiter(2, 1_000);
    expect(rl.allow("a", 0)).toBe(true);
    expect(rl.allow("a", 10)).toBe(true);
    expect(rl.allow("a", 20)).toBe(false);
    expect(rl.allow("b", 20)).toBe(true);
    expect(rl.allow("a", 1_011)).toBe(true);
  });
  it("cache expires entries after the TTL", () => {
    const c = new TtlCache<string>(100);
    c.set("k", "v", 0);
    expect(c.get("k", 99)).toBe("v");
    expect(c.get("k", 100)).toBeUndefined();
  });
});

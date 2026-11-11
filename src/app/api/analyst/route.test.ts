import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalystOutput } from "@/lib/analyst/output";

// Mock the Anthropic client; keep the real error classes for the error-mapping checks.
// next/cache's cacheLife needs the Next runtime; in tests the cache directive is a no-op.
vi.mock("next/cache", () => ({ cacheLife: () => {} }));
const parse = vi.fn();
vi.mock("@anthropic-ai/sdk", async () => {
  const actual = await vi.importActual<typeof import("@anthropic-ai/sdk")>("@anthropic-ai/sdk");
  const Mock = Object.assign(
    function MockAnthropic() {
      return { beta: { messages: { parse } } };
    },
    { AuthenticationError: actual.default.AuthenticationError, RateLimitError: actual.default.RateLimitError, APIError: actual.default.APIError, APIConnectionTimeoutError: actual.default.APIConnectionTimeoutError },
  );
  return { ...actual, default: Mock };
});

const output: AnalystOutput = {
  headline: "Revenue ahead of budget",
  summary: "Revenue is {{F5}} versus budget.",
  facts: [{ text: "Revenue variance is {{F5}}." }, { text: "EBITDA rose 12 %." }],
  hypotheses: [{ text: "Mix may have helped.", verify: "Review category sales with merchandising." }],
  recommendations: [{ text: "Investigate the largest cost driver." }],
};

const post = async (body: unknown, ip = "1.1.1.1") => {
  const { POST } = await import("./route");
  return POST(
    new Request("http://localhost/api/analyst", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
};

describe("POST /api/analyst", () => {
  beforeEach(() => {
    vi.resetModules(); // fresh in-memory cache and rate limiter per test
    parse.mockReset();
    process.env.ANTHROPIC_API_KEY = "test-key";
  });
  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("returns 503 when no API key is configured, without calling the model", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await post({ period: "2025-11", view: "ytd" });
    expect(res.status).toBe(503);
    expect(parse).not.toHaveBeenCalled();
  });

  it.each([["not json"], [{ period: "2025-13", view: "ytd" }], [{ period: "2025-11", view: "year" }], [{ period: "2025-11", view: "ytd", extra: 1 }]])(
    "rejects invalid input %j with 400",
    async (body) => {
      expect((await post(body)).status).toBe(400);
      expect(parse).not.toHaveBeenCalled();
    },
  );

  it("sends only the fact sheet, then validates and resolves the output", async () => {
    parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: output, model: "claude-opus-5-5" });
    const res = await post({ period: "2025-11", view: "ytd" });
    expect(res.status).toBe(200);
    const json = await res.json();

    const args = parse.mock.calls[0][0];
    expect(args.model).toBe("claude-opus-5-5");
    expect(args.output_config.effort).toBe("medium");
    expect(args.fallbacks).toBe("default");
    const sent: string = args.messages[0].content;
    expect(sent).toContain("F5 | Revenue — variance vs budget");
    expect(sent).not.toMatch(/amountDkk|accountId/);

    expect(json.analysis.facts).toHaveLength(1); // "EBITDA rose 12 %." removed
    expect(json.analysis.rejected).toHaveLength(1);
    const chip = json.analysis.summary.segments.find((s: { type: string }) => s.type === "fact");
    expect(chip.fact.id).toBe("F5");
    expect(chip.fact.value).toMatch(/6,7 mio\. kr\./);
  });

  it("marks a freshly generated result as not cached", async () => {
    parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: output, model: "claude-opus-5-5" });
    const json = await (await post({ period: "2025-06", view: "month" })).json();
    expect(json.cached).toBe(false);
    expect(Date.parse(json.generatedAt)).not.toBeNaN();
  });

  it("rejects non-JSON content types (cross-site simple requests) with 415", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/analyst", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ period: "2025-11", view: "ytd" }),
      }),
    );
    expect(res.status).toBe(415);
    expect(parse).not.toHaveBeenCalled();
  });

  it("rejects requests from another origin with 403", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/analyst", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
        body: JSON.stringify({ period: "2025-11", view: "ytd" }),
      }),
    );
    expect(res.status).toBe(403);
    expect(parse).not.toHaveBeenCalled();
  });

  it("accepts same-origin requests", async () => {
    parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: output, model: "claude-opus-5-5" });
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/analyst", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost" },
        body: JSON.stringify({ period: "2025-11", view: "ytd" }),
      }),
    );
    expect(res.status).toBe(200);
  });

  it("rate-limits fresh analyses per client", async () => {
    parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: output, model: "claude-opus-5-5" });
    const { POST } = await import("./route");
    const statuses: number[] = [];
    for (const period of ["2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06"]) {
      const res = await POST(
        new Request("http://localhost/api/analyst", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.9" },
          body: JSON.stringify({ period, view: "month" }),
        }),
      );
      statuses.push(res.status);
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  });

  it("maps refusals, truncation and malformed output to 502", async () => {
    parse.mockResolvedValueOnce({ stop_reason: "refusal", parsed_output: null, model: "m" });
    expect((await post({ period: "2025-01", view: "month" })).status).toBe(502);
    parse.mockResolvedValueOnce({ stop_reason: "max_tokens", parsed_output: null, model: "m" });
    expect((await post({ period: "2025-02", view: "month" })).status).toBe(502);
    parse.mockResolvedValueOnce({ stop_reason: "end_turn", parsed_output: null, model: "m" });
    expect((await post({ period: "2025-03", view: "month" })).status).toBe(502);
  });

  it("maps API errors without leaking details", async () => {
    parse.mockRejectedValueOnce(new Error("socket hang up"));
    const res = await post({ period: "2025-04", view: "month" });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("Could not reach the AI service.");
  });

  it("maps an SDK timeout to 504", async () => {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    parse.mockRejectedValueOnce(new Anthropic.APIConnectionTimeoutError());
    expect((await post({ period: "2025-05", view: "month" })).status).toBe(504);
  });
});

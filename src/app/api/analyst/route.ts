import { z } from "zod";
import { AnalystError, generateAnalysis, type AnalystResult } from "@/lib/analyst/generate";
import { RateLimiter } from "@/lib/analyst/guards";
import { periodSchema } from "@/lib/data/schema";

/**
 * AI financial analyst — server only. The API key is read from the server environment
 * (ANTHROPIC_API_KEY) and never reaches the browser. The client sends only a period and
 * view; the fact sheet is rebuilt on the server from the validated dataset.
 */

export const maxDuration = 120;

const requestSchema = z.object({ period: periodSchema, view: z.enum(["month", "ytd"]) }).strict();

export interface AnalystResponse extends AnalystResult {
  cached: boolean;
}

// Per-instance limit on requests; the shared cache and the API key's spend limit do the rest.
const limiter = new RateLimiter(5, 10 * 60_000);

function error(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  // Only same-origin JSON requests. This blocks other websites from triggering paid
  // analyses through a visitor's browser (a cross-site "simple" POST cannot send JSON).
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return error(415, "Content-Type must be application/json.");
  }
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return error(403, "Cross-origin requests are not allowed.");
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return error(503, "The AI analyst is not configured on this deployment (missing ANTHROPIC_API_KEY).");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "Request body must be JSON.");
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return error(400, "Invalid request: expected { period: 'YYYY-MM', view: 'month' | 'ytd' }.");

  const clientId = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const started = Date.now();
  if (!limiter.allow(clientId, started)) {
    return error(429, "Too many analyses requested. Please wait a few minutes and try again.");
  }

  try {
    const result = await generateAnalysis(parsed.data.period, parsed.data.view);
    // A cached result was generated before this request started.
    const cached = Date.parse(result.generatedAt) < started;
    return Response.json({ ...result, cached } satisfies AnalystResponse);
  } catch (err) {
    if (err instanceof AnalystError || (err instanceof Error && err.name === "AnalystError")) {
      const status = err instanceof AnalystError ? err.status : 502;
      return error(status, err.message);
    }
    return error(502, "The analysis could not be generated.");
  }
}

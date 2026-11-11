import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { buildFactSheet, type FactSheet } from "@/lib/analyst/fact-sheet";
import { RateLimiter, TtlCache } from "@/lib/analyst/guards";
import { analystOutputSchema, validateAnalysis, type ValidatedAnalysis } from "@/lib/analyst/output";
import { ANALYST_SYSTEM_PROMPT, buildUserMessage } from "@/lib/analyst/prompt";
import { getDataset } from "@/lib/data/dataset";
import { periodSchema } from "@/lib/data/schema";

/**
 * AI financial analyst — server only. The API key is read from the server environment
 * (ANTHROPIC_API_KEY) and never reaches the browser. The client sends only a period and
 * view; the fact sheet is rebuilt here from the validated dataset, so the model only sees
 * figures computed by FinanceOS.
 */

export const maxDuration = 60;

const MODEL = "claude-opus-5-5";
const requestSchema = z.object({ period: periodSchema, view: z.enum(["month", "ytd"]) }).strict();

export interface AnalystResponse {
  sheet: FactSheet;
  analysis: ValidatedAnalysis;
  model: string;
  cached: boolean;
  generatedAt: string;
}

const limiter = new RateLimiter(5, 10 * 60_000); // 5 fresh analyses per client per 10 minutes
const cache = new TtlCache<AnalystResponse>(6 * 60 * 60_000); // the demo data is static

function error(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
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

  const sheet = buildFactSheet(getDataset(), parsed.data);
  const key = `${sheet.period}|${sheet.view}`;
  const now = Date.now();
  const hit = cache.get(key, now);
  if (hit) return Response.json({ ...hit, cached: true } satisfies AnalystResponse);

  const clientId = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!limiter.allow(clientId, now)) {
    return error(429, "Too many analyses requested. Please wait a few minutes and try again.");
  }

  const client = new Anthropic();
  try {
    const message = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      // Opus 5.5 defaults to medium effort; set explicitly. Thinking is adaptive by default.
      output_config: { effort: "medium", format: betaZodOutputFormat(analystOutputSchema) },
      // If a safety classifier declines, the API retries on a fallback model in the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: ANALYST_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage(sheet) }],
    });

    if (message.stop_reason === "refusal") return error(502, "The model declined to produce an analysis.");
    if (message.stop_reason === "max_tokens") return error(502, "The analysis was cut off. Please try again.");
    if (!message.parsed_output) return error(502, "The model returned an analysis in an unexpected format.");

    const result: AnalystResponse = {
      sheet,
      analysis: validateAnalysis(message.parsed_output, sheet),
      model: message.model,
      cached: false,
      generatedAt: new Date(now).toISOString(),
    };
    cache.set(key, result, now);
    return Response.json(result);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return error(503, "The AI analyst's API key is invalid.");
    if (err instanceof Anthropic.RateLimitError) return error(429, "The AI service is busy. Please try again shortly.");
    if (err instanceof Anthropic.APIError) return error(502, `The AI service returned an error (${err.status ?? "unknown"}).`);
    return error(502, "Could not reach the AI service.");
  }
}

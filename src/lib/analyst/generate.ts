import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { cacheLife } from "next/cache";
import { getDataset } from "@/lib/data/dataset";
import { buildFactSheet, type FactSheet } from "./fact-sheet";
import { analystOutputSchema, validateAnalysis, type ValidatedAnalysis } from "./output";
import { ANALYST_SYSTEM_PROMPT, buildUserMessage } from "./prompt";

export const ANALYST_MODEL = "claude-opus-5-5";

export interface AnalystResult {
  sheet: FactSheet;
  analysis: ValidatedAnalysis;
  model: string;
  generatedAt: string;
}

/** A failure with an HTTP status for the route to return. Thrown (never returned) so it is not cached. */
export class AnalystError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AnalystError";
  }
}

/**
 * Generates (or returns the cached) analysis for one period/view.
 * `use cache: remote` stores successful results in the platform's shared cache, so repeat
 * requests from any server instance reuse them — the demo data is static, so the same input
 * always deserves the same answer. Failures throw and are therefore never cached.
 */
export async function generateAnalysis(period: string, view: "month" | "ytd"): Promise<AnalystResult> {
  "use cache: remote";
  cacheLife("hours");

  const sheet = buildFactSheet(getDataset(), { period, view });
  // Timeout and a single retry keep the call well inside the route's maxDuration.
  const client = new Anthropic({ timeout: 90_000, maxRetries: 1 });

  let message;
  try {
    message = await client.beta.messages.parse({
      model: ANALYST_MODEL,
      max_tokens: 16000,
      // Opus 5.5 defaults to medium effort; set explicitly. Thinking is adaptive by default.
      output_config: { effort: "medium", format: betaZodOutputFormat(analystOutputSchema) },
      // If a safety classifier declines, the API retries on a fallback model in the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: ANALYST_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage(sheet) }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new AnalystError(503, "The AI analyst's API key is invalid.");
    if (err instanceof Anthropic.RateLimitError) throw new AnalystError(429, "The AI service is busy. Please try again shortly.");
    if (err instanceof Anthropic.APIConnectionTimeoutError) throw new AnalystError(504, "The AI service took too long. Please try again.");
    if (err instanceof Anthropic.APIError) throw new AnalystError(502, `The AI service returned an error (${err.status ?? "unknown"}).`);
    throw new AnalystError(502, "Could not reach the AI service.");
  }

  if (message.stop_reason === "refusal") throw new AnalystError(502, "The model declined to produce an analysis.");
  if (message.stop_reason === "max_tokens") throw new AnalystError(502, "The analysis was cut off. Please try again.");
  if (!message.parsed_output) throw new AnalystError(502, "The model returned an analysis in an unexpected format.");

  return {
    sheet,
    analysis: validateAnalysis(message.parsed_output, sheet),
    model: message.model,
    generatedAt: new Date().toISOString(),
  };
}

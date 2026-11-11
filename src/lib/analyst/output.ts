import { z } from "zod";
import type { Fact, FactSheet } from "./fact-sheet";

/**
 * The analyst's structured output and the validation that keeps it honest.
 *
 * Rules enforced here (not just requested in the prompt):
 *  - Numbers may only appear as fact placeholders like {{F12}} that exist in the fact sheet.
 *  - Any digit or number word outside a placeholder rejects that statement.
 *  - Every fact statement must cite at least one fact.
 * Rejected statements are removed and counted, never silently "fixed".
 */

const statement = z.object({
  text: z.string().describe("One sentence. Refer to figures only with placeholders like {{F3}}."),
});

export const analystOutputSchema = z.object({
  headline: z.string().describe("Short headline for management, no figures."),
  summary: z.string().describe("Two to four sentences. Figures only as {{F#}} placeholders."),
  facts: z.array(statement).describe("Observations that restate facts from the sheet. No causes."),
  hypotheses: z
    .array(
      z.object({
        text: z.string().describe("A possible explanation, phrased as a hypothesis."),
        verify: z.string().describe("What data or person would confirm or reject it."),
      }),
    )
    .describe("Possible explanations to investigate. Never presented as fact."),
  recommendations: z.array(statement).describe("Concrete next steps for the finance team."),
});

export type AnalystOutput = z.infer<typeof analystOutputSchema>;

export type Segment = { type: "text"; text: string } | { type: "fact"; fact: Fact };

export interface ValidatedStatement {
  segments: Segment[];
  factIds: string[];
}

export interface ValidatedAnalysis {
  headline: ValidatedStatement;
  summary: ValidatedStatement;
  facts: ValidatedStatement[];
  hypotheses: (ValidatedStatement & { verify: ValidatedStatement })[];
  recommendations: ValidatedStatement[];
  /** Statements removed by validation, with the reason. */
  rejected: { section: string; reason: string }[];
}

const PLACEHOLDER = /\{\{\s*(F\d+)\s*\}\}/g;
const NUMBER_WORDS =
  /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|hundred|thousand|million|billion|percent|per cent|mio|bn|dozen|half)\b/i;

export type CheckResult = { ok: true; value: ValidatedStatement } | { ok: false; reason: string };

/** Validates one piece of model text and resolves placeholders to fact values. */
export function checkStatement(text: string, factsById: Map<string, Fact>, requireFact = false): CheckResult {
  const factIds: string[] = [];
  const segments: Segment[] = [];
  let last = 0;
  for (const match of text.matchAll(PLACEHOLDER)) {
    const id = match[1];
    const fact = factsById.get(id);
    if (!fact) return { ok: false, reason: `references unknown fact ${id}` };
    if (match.index > last) segments.push({ type: "text", text: text.slice(last, match.index) });
    segments.push({ type: "fact", fact });
    factIds.push(id);
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ type: "text", text: text.slice(last) });

  const freeText = text.replace(PLACEHOLDER, " ");
  if (/\d/.test(freeText)) return { ok: false, reason: "contains a number that is not from the fact sheet" };
  if (NUMBER_WORDS.test(freeText)) return { ok: false, reason: "contains a quantity written in words" };
  if (/[{}]/.test(freeText)) return { ok: false, reason: "contains a malformed placeholder" };
  if (requireFact && factIds.length === 0) return { ok: false, reason: "does not cite any fact" };
  if (freeText.trim() === "" && factIds.length === 0) return { ok: false, reason: "is empty" };
  return { ok: true, value: { segments, factIds } };
}

export function validateAnalysis(output: AnalystOutput, sheet: FactSheet): ValidatedAnalysis {
  const byId = new Map(sheet.facts.map((f) => [f.id, f]));
  const rejected: ValidatedAnalysis["rejected"] = [];
  const keep = (section: string, text: string, requireFact = false): ValidatedStatement | null => {
    const r = checkStatement(text, byId, requireFact);
    if (r.ok) return r.value;
    rejected.push({ section, reason: r.reason });
    return null;
  };
  const fallback = (text: string): ValidatedStatement => ({ segments: [{ type: "text", text }], factIds: [] });

  const headline = keep("headline", output.headline) ?? fallback("Management summary");
  const summary = keep("summary", output.summary) ?? fallback("The summary was removed because it failed validation.");
  const facts = output.facts.map((s) => keep("facts", s.text, true)).filter((s): s is ValidatedStatement => s !== null);
  const hypotheses = output.hypotheses.flatMap((h) => {
    const text = keep("hypotheses", h.text);
    const verify = keep("hypotheses", h.verify);
    return text && verify ? [{ ...text, verify }] : [];
  });
  const recommendations = output.recommendations
    .map((s) => keep("recommendations", s.text))
    .filter((s): s is ValidatedStatement => s !== null);

  return { headline, summary, facts, hypotheses, recommendations, rejected };
}

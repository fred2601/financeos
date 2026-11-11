"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, FlaskConical, ListChecks, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Fact, FactSheet, FactStatus } from "@/lib/analyst/fact-sheet";
import type { ValidatedStatement } from "@/lib/analyst/output";
import type { AnalystResponse } from "@/app/api/analyst/route";
import { cn } from "@/lib/utils";

const STATUS_CLASS: Record<FactStatus, string> = {
  favorable: "bg-favorable-soft text-favorable",
  unfavorable: "bg-unfavorable-soft text-unfavorable",
  "on budget": "bg-muted text-muted-foreground",
  "not applicable": "bg-muted text-muted-foreground",
};

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "done"; data: AnalystResponse };

export function AnalystWorkspace({ sheet }: { sheet: FactSheet }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [consent, setConsent] = useState(false);

  // Results belong to the period they were generated for; drop them if the period changes.
  const result = state.kind === "done" && state.data.sheet.period === sheet.period && state.data.sheet.view === sheet.view ? state.data : null;

  const generate = async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/analyst", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: sheet.period, view: sheet.view }),
      });
      const json: unknown = await res.json();
      if (!res.ok) {
        const message = typeof json === "object" && json !== null && "error" in json ? String(json.error) : "Request failed.";
        setState({ kind: "error", message });
        return;
      }
      setState({ kind: "done", data: json as AnalystResponse });
    } catch {
      setState({ kind: "error", message: "Could not reach the server." });
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
      <div className="flex min-w-0 flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" aria-hidden /> Management summary
            </CardTitle>
            <CardDescription>{sheet.scopeLabel} · written by Claude from the fact sheet only</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {!result && (
              <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-[var(--primary)]"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  <span>
                    Send the {sheet.facts.length} aggregated figures in the fact sheet to Anthropic&apos;s API to generate a
                    summary. No transaction-level data is sent.{" "}
                    {sheet.fictional && <span className="text-muted-foreground">(The data is fictional.)</span>}
                  </span>
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={generate} disabled={!consent || state.kind === "loading"}>
                    {state.kind === "loading" ? <Loader2 className="animate-spin" /> : <Sparkles />}
                    {state.kind === "loading" ? "Analysing…" : "Generate analysis"}
                  </Button>
                  {state.kind === "loading" && (
                    <span className="text-xs text-muted-foreground">This usually takes 15–40 seconds.</span>
                  )}
                </div>
                {state.kind === "error" && (
                  <p role="alert" className="flex items-center gap-2 text-sm text-unfavorable">
                    <AlertTriangle className="size-4 shrink-0" aria-hidden /> {state.message}
                  </p>
                )}
              </div>
            )}

            {result && <AnalysisView data={result} />}
          </CardContent>
        </Card>
      </div>

      <aside className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-favorable" aria-hidden /> Fact sheet
            </CardTitle>
            <CardDescription>
              The only figures the analyst may use, calculated by FinanceOS. The model refers to them by id and the
              server inserts the values.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FactTable facts={sheet.facts} />
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function AnalysisView({ data }: { data: AnalystResponse }) {
  const a = data.analysis;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          <Statement s={a.headline} />
        </h2>
        <p className="mt-2 text-sm leading-relaxed">
          <Statement s={a.summary} />
        </p>
      </div>

      <Section icon={CheckCircle2} title="Facts" hint="Observed in the data, each backed by the fact sheet" tone="favorable">
        {a.facts.map((s, i) => (
          <li key={i}>
            <Statement s={s} />
          </li>
        ))}
      </Section>

      <Section icon={FlaskConical} title="Hypotheses" hint="Possible explanations — not established causes" tone="amber">
        {a.hypotheses.map((h, i) => (
          <li key={i}>
            <Statement s={h} />
            <div className="mt-0.5 text-xs text-muted-foreground">
              To verify: <Statement s={h.verify} />
            </div>
          </li>
        ))}
      </Section>

      <Section icon={ListChecks} title="Recommendations" hint="Suggested next steps for the finance team" tone="primary">
        {a.recommendations.map((s, i) => (
          <li key={i}>
            <Statement s={s} />
          </li>
        ))}
      </Section>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
        <span>
          Model: <span className="font-mono">{data.model}</span>
        </span>
        <span>{data.cached ? "Cached result" : `Generated ${new Date(data.generatedAt).toLocaleString("da-DK")}`}</span>
        <span className={cn(a.rejected.length > 0 && "text-amber-700")}>
          {a.rejected.length === 0
            ? "All statements passed validation"
            : `${a.rejected.length} statement${a.rejected.length === 1 ? "" : "s"} removed by validation (${[...new Set(a.rejected.map((r) => r.reason))].join("; ")})`}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        AI-generated text can be wrong. Figures are inserted from the fact sheet and cannot be altered by the model, but
        hypotheses and recommendations are suggestions to review, not conclusions.
      </p>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  hint,
  tone,
  children,
}: {
  icon: typeof CheckCircle2;
  title: string;
  hint: string;
  tone: "favorable" | "amber" | "primary";
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Icon
          className={cn(
            "size-4",
            tone === "favorable" && "text-favorable",
            tone === "amber" && "text-amber-600",
            tone === "primary" && "text-primary",
          )}
          aria-hidden
        />
        {title}
        <span className="font-normal text-muted-foreground">· {hint}</span>
      </h3>
      <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed marker:text-muted-foreground">
        {children}
      </ul>
    </section>
  );
}

/** Renders text with validated figures as highlighted chips (hover shows the source fact). */
function Statement({ s }: { s: ValidatedStatement }) {
  return (
    <>
      {s.segments.map((seg, i) =>
        seg.type === "text" ? (
          <span key={i}>{seg.text}</span>
        ) : (
          <span
            key={i}
            title={`${seg.fact.id} · ${seg.fact.label}`}
            className={cn("num rounded px-1 py-px font-medium whitespace-nowrap", STATUS_CLASS[seg.fact.status])}
          >
            {seg.fact.value}
          </span>
        ),
      )}
    </>
  );
}

function FactTable({ facts }: { facts: Fact[] }) {
  return (
    <div className="max-h-[640px] overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">Id</TableHead>
            <TableHead>Figure</TableHead>
            <TableHead className="text-right">Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {facts.map((f) => (
            <TableRow key={f.id}>
              <TableCell className="font-mono text-xs text-muted-foreground">{f.id}</TableCell>
              <TableCell className="text-xs whitespace-normal">
                {f.label}
                {f.status !== "not applicable" && (
                  <Badge variant="outline" className={cn("ml-1.5 border-0 text-[10px]", STATUS_CLASS[f.status])}>
                    {f.status}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="num text-right text-xs whitespace-nowrap">{f.value}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

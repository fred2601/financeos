# CLAUDE.md — FinanceOS project conventions

FinanceOS is a portfolio FP&A web app (Next.js App Router + TypeScript) for a fictional
Danish retailer, **Fjordhus Retail A/S (fictional)**. Read `docs/ARCHITECTURE.md` for the
data schema and formulas and `docs/ROADMAP.md` for the current milestone.

## Working agreement
- The owner is a finance student with limited coding experience: explain important
  decisions in plain language, in finance terms where possible.
- Work **one milestone at a time**. Do not start the next milestone without approval.
- The app must build and run (`npm run build`, `npm test`) at the end of every milestone.
- Commit at each checkpoint with a clear message (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).
- Prefer a working financial MVP over extra features. Ask before adding a dependency.

## Commands
- `npm run dev` — local dev server (http://localhost:3000)
- `npm test` — Vitest unit tests (run before every commit)
- `npm run lint` / `npm run typecheck` — must pass with zero errors
- `npm run seed` — regenerate the fictional dataset (deterministic; same output every run)

## Architecture rules
- **All financial calculations live in `src/lib/finance/`** as pure functions
  (no React, no I/O, no `Date.now()`). UI components never compute KPIs, margins or variances.
- Pages build view-models via `src/lib/selectors/`, then pass plain data to components.
- Formatting (DKK, %, pp, t.DKK/mio. DKK) only in `src/lib/format/`.
- Charts in `src/components/charts/` receive ready-to-plot arrays; no math inside.
- Server Components by default; add `"use client"` only for interactivity (charts, inputs).
- Filters (period, department, category) live in URL search params.
- Next.js 16 with Cache Components: a page that reads `searchParams` must await it inside a
  child component wrapped in `<Suspense>` (see `src/app/dashboard/page.tsx`). Check the bundled
  docs in `node_modules/next/dist/docs/` before using unfamiliar Next APIs (see AGENTS.md).
- Do not export non-component values from `"use client"` files for use in Server Components.

## Financial rules (non-negotiable)
- Revenue = units × average selling price. Gross profit = revenue − COGS.
- EBITDA = gross profit − operating expenses; **depreciation & amortisation are excluded**.
- Margins = metric / revenue; return `null` when revenue ≤ 0.
- Absolute variance = actual − budget. % variance = (actual − budget) / |budget|; `null` if budget is 0/null.
- Favorable/unfavorable is decided by **account direction** (higher-is-better vs lower-is-better), never by sign alone.
- Amounts are stored positive in their natural direction; account type determines add/subtract.
- Missing values are `null`, never silently `0`. Display `null` as "n/a".
- Use `safeDivide` from `lib/finance/safe-math.ts` for every division.
- Round only for display, never inside calculations.
- Report variances and trends; never assert causes. Correlation ≠ causality.

## Testing
- Every function in `src/lib/finance/` has Vitest tests, including edge cases:
  zero denominators, nulls, negative results, negative budgets.
- Data-integrity tests on the seed: 24 months × actual/budget present, REV = units × ASP,
  no NaN/Infinity, all accountIds exist in the chart of accounts.

## Code style
- TypeScript `strict: true`; no `any` (use `unknown` + narrowing). No non-null `!` assertions on data.
- Small, single-purpose components and functions. Named exports. File names kebab-case.
- Tailwind + shadcn/ui only; design tokens in `globals.css`. Navy sidebar, neutral background.
- Number display: Danish locale (`da-DK`), e.g. `1.234.567 kr.`, `12,3 %`, `+1,2 pp`.
  Tabular numerals (`tabular-nums`) and right-aligned numbers in tables.

## Data & security
- All mock data is fictional and must be visibly labelled as such in the UI.
- Never commit secrets. Secrets go in `.env.local` (git-ignored); document names in `.env.example`.
- `ANTHROPIC_API_KEY` is server-only (route handlers). Never use a `NEXT_PUBLIC_` prefix for secrets.
- Never send imported/user data to an external AI service without explicit opt-in in the UI.
- AI analyst: the model only sees the fact sheet (`lib/analyst/fact-sheet.ts`) and may reference figures only as `{{F#}}` placeholders; keep the validator in `lib/analyst/output.ts` strict. Add new figures to the fact sheet, never to the prompt text.
- Validate every CSV/Excel import with zod and show row-level errors.

## Docs
- Update `docs/ARCHITECTURE.md` when formulas or schema change, and the "Known limitations" section when you add a simplification.
- Tick items in `docs/ROADMAP.md` as they are completed.

# FinanceOS — Roadmap & Checklist

Budget: ~4 weeks, 30–45 hours. Estimates include testing and explanation time.
Rule: the app runs, tests pass and a Git commit is made at the end of every milestone.

| # | Milestone | Est. | Week |
|---|---|---|---|
| **M1** ✅ | Foundation, fictional data, finance engine, executive dashboard | 10–12 h | 1 |
| **M2** ✅ | Budget vs actual analysis (filters, account table, breakdowns) | 6–8 h | 2 |
| **M3** ✅ | Driver-based forecast (units × ASP, editable assumptions, formula view) | 5–7 h | 2–3 |
| **M4** ✅ | Scenario analysis (base/best/worst, sliders, comparison) | 4–6 h | 3 |
| M5 | CSV/Excel import with validation (deferred) | 3–5 h | 3–4 |
| **M6** ✅ | AI financial analyst (optional) | 3–4 h | 4 |
| **M7** ✅ | Polish, responsive QA, docs, demo script, final deploy | 2–3 h | 4 |

Priority if time runs short: M1 → M2 → M3 → M4 are the **MVP**. M5 and M6 are stretch goals.

---

## Milestone 1 — Foundation + executive dashboard (detailed)

**Definition of done:** visiting `/dashboard` shows the executive dashboard for a selectable
month of the fictional company, every number comes from tested functions, `npm test`,
`npm run typecheck`, `npm run lint` and `npm run build` pass, and it is deployed to Vercel.

### 1A. Project setup (~1.5 h) — checkpoint commit `chore: scaffold`
- [x] `git init`, `.gitignore`, `.env.example`
- [x] Create Next.js app (App Router, TypeScript, Tailwind, ESLint, `src/` dir)
- [x] Confirm `strict: true`; add `typecheck` and `test` scripts
- [x] Install & configure Vitest
- [x] Initialise shadcn/ui (card, button, select, badge, table, tooltip, separator)
- [x] Add Recharts and Zod
- [x] Design tokens in `globals.css` (navy sidebar, neutral surfaces, accent, favorable/unfavorable colours)

### 1B. Data schema + fictional dataset (~2.5 h) — commit `feat: fictional dataset`
- [x] `lib/data/schema.ts`: types + zod schemas (Account, FinancialRecord, dimensions)
- [x] `lib/data/chart-of-accounts.ts` with account types & directions
- [x] `scripts/generate-seed.ts`: seeded random generator (same output every run)
  - units × ASP per category/channel/month, seasonality curves, COGS via category margins
  - opex by department (fixed + variable components), DA
  - budget = "plan" curve; actual = plan + planted deviations + small noise
- [x] Generate `src/data/seed/fjordhus-2024-2025.json`
- [x] `lib/data/dataset.ts`: load + validate at build time
- [x] `docs/DATA.md`: company profile, dimensions, storyline of planted deviations
- [x] Data integrity tests (completeness, REV = units × ASP, no NaN, valid ids, plausible margins)

### 1C. Finance engine (~2.5 h) — commit `feat: finance engine`
- [x] `safe-math.ts`: `safeDivide`, null-aware `sum`
- [x] `periods.ts`: previous month, YTD range, same month last year, month labels
- [x] `aggregate.ts`: filter + sum by account type, period range, category, channel, department
- [x] `metrics.ts`: revenue, COGS, gross profit, gross margin, opex, EBITDA, EBITDA margin, ASP
- [x] `variance.ts`: absolute, %, margin delta in pp, favorable/unfavorable/neutral
- [x] Unit tests incl. zero revenue, null values, negative EBITDA, negative budget, zero budget

### 1D. App shell + executive dashboard (~3.5 h) — commit `feat: executive dashboard`
- [x] Layout: dark navy sidebar (Dashboard active; Variance/Forecast/Scenarios shown as "coming soon"),
      top bar with company name, **"Fictional data"** badge, period selector
- [x] `lib/format/`: DKK (kr., t.kr., mio. kr.), %, percentage points, Danish month names
- [x] `lib/selectors/dashboard.ts`: one view-model for the page
- [x] KPI cards (selected month **and** YTD toggle): Revenue, Gross profit, Gross margin,
      EBITDA, EBITDA margin — each with vs budget (abs + %) and vs previous month, coloured by favorability
- [x] Monthly trend chart: revenue actual vs budget (24 months)
- [x] Margin trend chart: gross margin & EBITDA margin
- [x] EBITDA bar chart: actual vs budget by month
- [x] Revenue by category table: actual, budget, variance, % variance, gross margin
- [x] Empty/"n/a" states, loading skeleton, responsive down to tablet/mobile
- [x] Footnote: definitions of KPIs (EBITDA excludes D&A)

### 1E. Verify & ship (~1 h) — commit `chore: milestone 1`
- [x] All checks pass; manual check of 2–3 KPIs against a hand calculation
- [x] Push to GitHub, deploy to Vercel (https://financeos-kappa-nine.vercel.app, auto-deploys on push to `main`)
- [x] Update README status and this checklist

**Not in M1:** department filters, variance drill-down, forecasting, scenarios, imports, AI.

---

## Later milestones (outline)

### M2 — Budget vs actual ✅
- [x] Account-level variance table (abs, %, EBITDA impact, favorable/unfavorable/on-budget badges)
- [x] "Largest variances" list ranked by EBITDA impact
- [x] Filters: month/YTD, period, department, category (URL params)
- [x] Revenue breakdown (category × channel: units, ASP, volume and price effects)
- [x] Cost breakdown (department × account)
- [x] Three-way price/volume/mix split of revenue variance
- [x] EBITDA bridge (waterfall) from budget to actual
- [x] Materiality threshold (1 % and 50 t.kr.; 0,1 pp for margins), also applied on the dashboard

### M3 — Forecast ✅
- [x] FY2026 monthly forecast: units × ASP per category with editable unit growth and price change
- [x] Gross margin change (pp) per category and cost growth per opex account → gross profit and EBITDA
- [x] "Show formulas" view with the actual numbers plugged in; assumptions stored in the URL (shareable link)
- [x] Tests for the forecast engine, view-model and URL handling

### M4 — Scenarios ✅
- [x] Worst / base / best presets; editable sales growth, gross margin (pp) and opex change per scenario
- [x] Live EBITDA recalculation, side-by-side scenario cards, full-year and monthly EBITDA charts
- [x] Comparison table with best–worst spread; closed-form EBITDA formula and base-case sensitivities
- [x] Ordering warning; levers stored in a shareable URL
- [x] Tests for the scenario engine and view-model (engine = closed form, URL round-trip)

### M5 — Import
- [ ] CSV + Excel upload, column mapping to the fact schema, zod validation with row-level errors
- [ ] Imported data stays in the browser; clear "your data" vs "fictional data" indicator
- [ ] Library choice: decide between SheetJS (official CDN build — the npm `xlsx` package is outdated) and ExcelJS

### M6 — AI analyst ✅
- [x] Server route calls the Anthropic API (`claude-opus-5-5`) with a **pre-computed fact sheet** only
- [x] Structured output: headline, summary, facts, hypotheses (with how to verify), recommendations
- [x] Numbers only via `{{F#}}` placeholders; server-side validation removes any other number; values inserted from the fact sheet
- [x] Explicit consent before sending; key only in server env vars; 503 state when not configured
- [x] Result cache and per-client rate limit; tests for fact sheet, validator, guards and route (mocked model)
- [x] `ANTHROPIC_API_KEY` set in Vercel; live analysis verified 2026-11-11 (figures match the app, 0 statements rejected)

### M7 — Polish ✅
- [x] Responsive QA at phone, tablet and desktop; forecast inputs in two columns on tablet with a sticky live summary
- [x] Accessibility pass: skip link, focus rings on custom controls, text alternatives for charts, status in text and colour
- [x] App icon, 404 page, metadata; chart label fixes
- [x] README rewritten with screenshots (`docs/screenshots/`); demo script for interviews (`docs/DEMO.md`)

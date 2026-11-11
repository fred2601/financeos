# FinanceOS — Roadmap & Checklist

Budget: ~4 weeks, 30–45 hours. Estimates include testing and explanation time.
Rule: the app runs, tests pass and a Git commit is made at the end of every milestone.

| # | Milestone | Est. | Week |
|---|---|---|---|
| **M1** ✅ | Foundation, fictional data, finance engine, executive dashboard | 10–12 h | 1 |
| M2 | Budget vs actual analysis (filters, account table, breakdowns) | 6–8 h | 2 |
| M3 | Driver-based forecast (units × ASP, editable assumptions, formula view) | 5–7 h | 2–3 |
| M4 | Scenario analysis (base/best/worst, sliders, comparison) | 4–6 h | 3 |
| M5 | CSV/Excel import with validation | 3–5 h | 3–4 |
| M6 | AI financial analyst (optional) | 3–4 h | 4 |
| M7 | Polish, responsive QA, docs, demo script, final deploy | 2–3 h | 4 |

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

### M2 — Budget vs actual
- [ ] Account-level variance table (abs, %, favorable/unfavorable badges), sorted by impact
- [ ] Filters: month/YTD, department, category (URL params)
- [ ] Revenue breakdown (category × channel) and cost breakdown (department × account)
- [ ] Price/volume split of revenue variance (units effect vs ASP effect)
- [ ] Materiality threshold (e.g. flag |variance| > 5 % and > 100 t.kr.); treat immaterial variances as neutral
  (today a −0,0 pp margin change is coloured red)

### M3 — Forecast
- [ ] FY2026 monthly forecast: units × ASP per category with editable growth/ASP assumptions
- [ ] Gross margin % and opex assumptions → gross profit and EBITDA forecast
- [ ] "Show formula" panel for each line; assumptions stored in URL/localStorage
- [ ] Tests for forecast engine

### M4 — Scenarios
- [ ] Base / best / worst presets; sliders for sales growth, gross margin, opex change
- [ ] Live EBITDA recalculation and side-by-side comparison chart/table
- [ ] Tests for scenario engine

### M5 — Import
- [ ] CSV + Excel upload, column mapping to the fact schema, zod validation with row-level errors
- [ ] Imported data stays in the browser; clear "your data" vs "fictional data" indicator
- [ ] Library choice: decide between SheetJS (official CDN build — the npm `xlsx` package is outdated) and ExcelJS

### M6 — AI analyst
- [ ] Server route calls Anthropic API with **pre-computed** metrics only
- [ ] Output structured as Facts / Hypotheses / Recommendations; numbers cross-checked against inputs
- [ ] Explicit opt-in before sending imported data; key only in server env vars

### M7 — Polish
- [ ] Responsive QA, accessibility pass, demo walkthrough script for interviews, screenshots in README

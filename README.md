# FinanceOS

**A financial planning & analysis (FP&A) platform for finance managers.**
Executive KPIs, budget vs actual analysis, driver-based forecasting and scenario modelling,
built on a fictional Danish retailer, **Fjordhus Retail A/S**.

> ⚠️ **All company data in this project is fictional.** It was generated for demonstration
> purposes and does not represent any real company.

> Status: in development. **Milestone 1 (executive dashboard) is complete**; Milestone 2 (budget vs actual) is next.
> See [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Features (planned)

| Module | What it answers |
|---|---|
| Executive dashboard | How are we doing this month and year-to-date versus budget and last month? |
| Budget vs actual | Which accounts, departments and categories drive the deviation? |
| Forecasting | Where will revenue, gross profit and EBITDA land, given units and price assumptions? |
| Scenarios | What happens to EBITDA in a best/base/worst case? |
| AI analyst (optional) | A concise management summary based only on validated numbers. |

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS · shadcn/ui · Recharts · Zod · Vitest · Vercel

## Getting started

### Prerequisites
- [Node.js](https://nodejs.org/) 22 LTS or newer (`node -v`)
- Git

### Install and run

```bash
git clone <repo-url> financeos
```

```bash
cd financeos
```

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000.

### Useful scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server |
| `npm test` | Run unit tests (finance calculations + data integrity) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | Lint |
| `npm run build` | Production build |
| `npm run seed` | Regenerate the fictional dataset (deterministic) |
| `npm run check` | Typecheck + lint + tests in one go |

### Environment variables

Not needed until the optional AI analyst (Milestone 6). Copy `.env.example` to `.env.local`:

```
ANTHROPIC_API_KEY=   # server-side only, never exposed to the browser
```

## How it works

- **Data** — a generated "GL extract" of 24 months (Jan 2024 – Dec 2025) of actuals and
  budget, by account, product category, channel and department.
- **Finance engine** — pure, unit-tested TypeScript functions in `src/lib/finance/` compute
  every KPI. Components only display results.
- **Pages** — server-rendered Next.js pages with filters in the URL, so any view can be shared.

Full details: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (schema, formulas, design decisions).

## Key definitions

- Gross profit = revenue − COGS; gross margin = gross profit / revenue
- EBITDA = gross profit − operating expenses (excludes depreciation & amortisation)
- Variance = actual − budget; % variance = variance / |budget|
- Favorable/unfavorable depends on the account: higher revenue is favorable, higher cost is unfavorable.

## Assumptions & limitations

- One company, DKK only, fiscal year = calendar year.
- No balance sheet, cash flow, VAT or inventory modelling.
- No user accounts or database; data lives in the app or in the browser session.
- The app reports variances; it does not claim to know their causes.

## Author

Built as a portfolio project by a Finance (BSc) student in Denmark, with Claude Code as a pair programmer.

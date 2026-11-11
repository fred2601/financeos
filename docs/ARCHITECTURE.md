# FinanceOS — Architecture, Data Schema & Formulas

> Status: approved 2026-11-11. Milestones 1–2 implemented.
> All company data in FinanceOS is **fictional** unless a user imports their own.

---

## 1. Guiding principles

1. **Finance logic lives in one place.** Every number shown on screen is produced by a pure,
   tested TypeScript function in `src/lib/finance/`. UI components only *display* results.
2. **Data first, UI second.** A clean, validated dataset with documented accounting rules is
   what makes the dashboards trustworthy.
3. **No backend until we need one.** The fictional dataset ships with the app as a static file.
   Imported files are parsed in the browser and never leave the user's machine.
   Supabase is only added if we later need saved data across devices/users.
4. **Explainable numbers.** Every KPI can be traced to a formula documented below.

---

## 2. High-level architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  Browser                                                             │
│                                                                      │
│  app/ (pages, Next.js App Router)                                    │
│    │  reads URL filters (?period=2025-10)                            │
│    ▼                                                                 │
│  lib/selectors/   "view models": shape data for one page             │
│    │  calls                                                          │
│    ▼                                                                 │
│  lib/finance/     PURE FUNCTIONS: aggregate, metrics, variance,      │
│    │              forecast, scenarios  ← 100% unit tested (Vitest)   │
│    ▼                                                                 │
│  lib/data/        schema (types + validation), dataset loader        │
│    │                                                                 │
│    ▼                                                                 │
│  data/seed/       fictional dataset (generated JSON, committed)      │
│                                                                      │
│  components/      layout (sidebar), ui (shadcn), charts (Recharts),  │
│                   dashboard widgets — display only                   │
└──────────────────────────────────────────────────────────────────────┘
          │ (Milestone 6 only)
          ▼
   app/api/analyst/route.ts  ── server-side ──►  Anthropic API
   (API key in env var; sends only aggregated, validated metrics)
```

**In plain terms:** the data file is the "general ledger extract", `lib/finance` is the
"Excel model", and the pages are the "management report". We keep the model separate from
the report so we can test the model on its own and reuse it on every page.

### Why these choices

| Decision | Why |
|---|---|
| Next.js App Router + TypeScript strict | Industry standard; strict mode catches mistakes (e.g. a possibly-missing value) before they reach the screen. |
| Static seed data, no database (M1–M5) | Fewer moving parts, free hosting, nothing to break during a demo. |
| Filters in the URL (`?period=2025-10&dept=marketing`) | A CFO can bookmark/share an exact view; back button works; no state library needed. |
| Pure functions for finance | Same input → same output. Easy to test, easy to explain in an interview. |
| Zod for validation | One small library validates both the seed data and user imports with clear error messages. |
| Recharts | Composable React charts; enough control for an enterprise look. |
| shadcn/ui | Copy-in components (not a black-box dependency); we own and style the code. |

### Folder structure (target)

```
financeos/
├─ CLAUDE.md                     project conventions for Claude Code
├─ README.md
├─ docs/
│  ├─ ARCHITECTURE.md            this file
│  ├─ ROADMAP.md                 milestones + checklist
│  └─ DATA.md                    dataset description & fictional storyline (M1)
├─ scripts/
│  └─ generate-seed.ts           deterministic generator for the fictional dataset
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx              app shell: navy sidebar + top bar
│  │  ├─ page.tsx                → redirects to /dashboard
│  │  ├─ dashboard/page.tsx      Executive dashboard (M1)
│  │  ├─ variance/page.tsx       Budget vs actual (M2)
│  │  ├─ forecast/page.tsx       Forecasting (M3)
│  │  ├─ scenarios/page.tsx      Scenario analysis (M4)
│  │  └─ api/analyst/route.ts    AI analyst, server only (M6)
│  ├─ components/
│  │  ├─ ui/                     shadcn primitives
│  │  ├─ layout/                 Sidebar, TopBar, PageHeader, FictionalDataBadge
│  │  ├─ charts/                 TrendChart, ActualVsBudgetChart, MarginChart
│  │  └─ dashboard/              KpiCard, KpiGrid, CategoryTable
│  ├─ lib/
│  │  ├─ finance/                ← all calculations (pure, tested)
│  │  │  ├─ metrics.ts           gross profit, margins, EBITDA
│  │  │  ├─ variance.ts          abs/% variance, favorable/unfavorable
│  │  │  ├─ aggregate.ts         sum by period/account/category, YTD
│  │  │  ├─ periods.ts           period math (prev month, YTD range)
│  │  │  ├─ safe-math.ts         safeDivide, null-aware sums
│  │  │  └─ *.test.ts
│  │  ├─ data/
│  │  │  ├─ schema.ts            types + zod schemas
│  │  │  ├─ chart-of-accounts.ts accounts, account types, sign rules
│  │  │  └─ dataset.ts           loads + validates seed
│  │  ├─ selectors/              build page view-models from finance functions
│  │  └─ format/                 Danish number/currency/percent formatting
│  └─ data/seed/
│     └─ fjordhus-2024-2025.json generated, committed
└─ vitest.config.ts
```

---

## 3. Fictional company

**Fjordhus Retail A/S (fictional)** — a Danish omnichannel home & lifestyle retailer,
~DKK 400–450m annual revenue, 18 stores plus a webshop. Fiscal year = calendar year.

- **Periods:** 24 months, **Jan 2024 – Dec 2025** (two full fiscal years, so we get
  month-over-month *and* year-over-year comparisons). Budget exists for both years.
  FY2026 is the year we will forecast in Milestone 3.
- **Product categories (3):** `home-living`, `fashion`, `outdoor-sport`
- **Channels (revenue side):** `stores`, `ecommerce`
- **Departments / cost centres (cost side):** `stores`, `ecommerce`, `marketing`,
  `logistics`, `head-office`
- **Seasonality:** strong Q4 (Black Friday + Christmas), summer peak for outdoor-sport,
  January sales dip in margin.
- **Planted budget deviations** (so the variance analysis has something to find), e.g.
  fashion under budget in spring 2025, freight costs over budget H2 2024,
  marketing overspend in Nov 2025, e-commerce ahead of budget. These are documented in
  `docs/DATA.md` as *the scenario the data was built from* — the app itself never claims
  causes, it only reports variances.

---

## 4. Data schema

We use a **"long" (tidy) fact table**, the same shape as a GL/BI extract. One row = one
amount for one account, period, scenario and dimension combination. This shape makes
filtering and aggregation trivial and matches how CSV/Excel imports will look.

### 4.1 Chart of accounts

```ts
type AccountType = "revenue" | "cogs" | "opex" | "da";   // da = depreciation & amortisation

interface Account {
  id: string;            // "REV", "COGS", "OPEX_PERSONNEL", ...
  name: string;          // "Revenue", "Personnel costs", ...
  type: AccountType;
}
```

| id | name | type | Dimension used |
|---|---|---|---|
| `REV` | Revenue | revenue | category + channel |
| `COGS` | Cost of goods sold | cogs | category + channel |
| `OPEX_PERSONNEL` | Personnel costs | opex | department |
| `OPEX_RENT` | Rent & facilities | opex | department |
| `OPEX_MARKETING` | Marketing | opex | department |
| `OPEX_LOGISTICS` | Logistics & freight | opex | department |
| `OPEX_IT` | IT & software | opex | department |
| `OPEX_OTHER` | Other operating expenses | opex | department |
| `DA` | Depreciation & amortisation | da | department |

`DA` is included on purpose so the app can *show* that EBITDA excludes it.

### 4.2 Fact rows

```ts
type Scenario = "actual" | "budget";        // later: "forecast", scenario ids
type Period   = `${number}-${string}`;      // "2025-10" (ISO year-month)

interface FinancialRecord {
  period: Period;
  scenario: Scenario;
  accountId: string;
  category: CategoryId | null;     // set for REV / COGS, null for opex
  channel: ChannelId | null;       // set for REV / COGS
  department: DepartmentId | null; // set for opex / DA
  amountDkk: number;               // whole DKK, see sign convention
  units: number | null;            // REV rows only: units sold
}
```

### 4.3 Conventions

- **Sign convention:** all amounts are stored as **positive numbers** in their natural
  direction (revenue positive, costs positive). The account `type` decides whether a
  number is added or subtracted. This avoids the classic "is this cost negative?" error.
  A negative amount means a genuine reversal/credit (e.g. a rebate) and is allowed.
- **Currency & units:** all money in **DKK, whole kroner**. Display is scaled
  (t.DKK / mio. DKK) only in the formatting layer.
- **Missing vs zero:** a missing value is `null` (or an absent row), never silently `0`.
  KPIs that depend on missing data show "n/a" instead of a misleading number.
- **Revenue integrity:** in the seed, `REV.amountDkk = units × ASP` (rounded to whole DKK).
  ASP is derived when needed: `ASP = revenue / units`. A test asserts this holds.

---

## 5. Key formulas (implemented in `src/lib/finance/`)

| Metric | Formula | Edge cases |
|---|---|---|
| Revenue | Σ REV amounts (= Σ units × ASP) | — |
| Average selling price | revenue / units | units = 0 or null → `null` |
| COGS | Σ COGS amounts | — |
| Gross profit | revenue − COGS | may be negative |
| Gross margin | gross profit / revenue | revenue ≤ 0 → `null` ("n/a") |
| Operating expenses | Σ OPEX amounts (excl. DA) | — |
| EBITDA | gross profit − operating expenses | DA explicitly excluded; may be negative |
| EBITDA margin | EBITDA / revenue | revenue ≤ 0 → `null` |
| Absolute variance | actual − budget | either side null → `null` |
| % variance | (actual − budget) / \|budget\| | budget = 0 or null → `null` |
| MoM change | (this month − prev month) / \|prev month\| | prev = 0 → `null` |
| YTD | Σ Jan..selected month of the same fiscal year | — |
| Margin change | margin(actual) − margin(budget), shown in **percentage points** | either null → `null` |

### Favorable / unfavorable — based on account type, not sign

```
direction(metric) = "higher-is-better" for revenue, gross profit, EBITDA, margins
                    "lower-is-better"  for COGS, opex, DA

variance > 0 and higher-is-better  → favorable
variance < 0 and higher-is-better  → unfavorable
variance > 0 and lower-is-better   → unfavorable   (spent more than budget)
variance < 0 and lower-is-better   → favorable
variance = 0 or null               → neutral
```

Why `/ |budget|`: if a budget is negative (e.g. budgeted EBITDA loss of −1m and actual −0.5m),
dividing by the raw budget would flip the sign and show an improvement as −50%. Using the
absolute value keeps "+50% = better than budget" intuitive.

### Materiality (`lib/finance/materiality.ts`)

A variance is only coloured favorable/unfavorable when it is **material**; otherwise it is
"on budget" (neutral). Defaults:

| Metric kind | Material when |
|---|---|
| Amount (DKK) | \|variance\| ≥ 50.000 kr. **and** \|variance %\| ≥ 1 % (or no budget to compare with) |
| Ratio (margins) | \|change\| ≥ 0,1 pp |
| Driver (units, ASP) | \|variance %\| ≥ 1 % |

### Price / volume / mix (`lib/finance/price-volume.ts`)

Segments = product category × channel. For segment *s*: U = units, P = ASP = revenue / units, C = COGS per unit.
A = actual, B = budget.

| Effect | Formula |
|---|---|
| Revenue volume | (ΣU_A − ΣU_B) × P̄_B, where P̄_B = budget revenue / budget units |
| Revenue mix | Σ U_A,s × P_B,s − ΣU_A × P̄_B |
| Revenue price | Σ (P_A,s − P_B,s) × U_A,s |
| Segment volume / price | (U_A − U_B) × P_B and (P_A − P_B) × U_A |
| GP volume & mix | Σ (U_A,s − U_B,s) × (P_B,s − C_B,s) |
| GP price | Σ (P_A,s − P_B,s) × U_A,s (100 % flow-through) |
| GP product cost | −Σ (C_A,s − C_B,s) × U_A,s |

Each split reconciles exactly to the total variance (tested). If any segment has zero budget
units, there is no budget price and the analysis returns `null` ("n/a").

**EBITDA bridge:** budget EBITDA → GP volume & mix → price → product cost → each opex account
(budget − actual) → actual EBITDA.

### Filter scope on Budget vs actual
- **Category** filters revenue, COGS and gross profit. Opex is not allocated to categories.
- **Department** filters operating expenses. Revenue is not booked on departments.
- EBITDA and the EBITDA bridge are always shown for the company as a whole.

### Correlation ≠ causality

The app reports *what* changed (variances, trends). It does not state *why*. In the
AI analyst (M6), explanations must be labelled as **facts** (validated numbers),
**hypotheses** (possible drivers to investigate) or **recommendations**.

---

## 6. Security & privacy

- No secrets in the repo. `.env.local` is git-ignored; `.env.example` documents variable names.
- `ANTHROPIC_API_KEY` is read only in `app/api/analyst/route.ts` (server). Never prefixed
  with `NEXT_PUBLIC_`, so it is never bundled into the browser.
- Imported files are parsed client-side and never uploaded anywhere.
- The AI analyst sends only aggregated metrics, and only for data the user has explicitly
  opted to send. Imported (possibly real) data requires an explicit consent toggle.

## 7. Known limitations (to be kept up to date)

- Single company, single currency (DKK), calendar fiscal year.
- No user accounts or persistence (by design, until needed).
- Seed data is synthetic and simplified (no VAT, inventory, balance sheet or cash flow).
- Rent is treated as operating expense (pre-IFRS 16 management view), so EBITDA is lower than an IFRS 16 EBITDA would be.
- Materiality thresholds are fixed company-wide (not per account or per period length).
- Mix is measured on units across categories with very different prices; a value-based mix would give different (equally valid) splits.

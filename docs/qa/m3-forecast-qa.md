# QA review — Milestone 3 (driver-based forecast)

Date: 2026-11-11 · Scope: `src/lib/finance/forecast.ts`, `src/lib/selectors/forecast.ts`,
forecast page. No new features; interface unchanged except one explanatory note.

Automated tests: `src/lib/selectors/forecast.regression.test.ts` (59 tests). Full suite:
**132 tests passing**. Unless stated, checks run against three assumption sets: all zero,
the defaults, and a mixed set with negative values (units −4 %, price −2 %, margin −2 pp,
opex −3 % / −1,5 %).

## Results

| # | Check | Result | How it was tested |
|---|---|---|---|
| 1 | Revenue = units × ASP, all categories and months | ✅ Pass | 3 categories × 12 months × 3 sets: forecast units = base units × (1 + g); revenue = units_F × ASP_base × (1 + price), within 0,0001 kr. Annual per category as well. |
| 2 | GP, opex, EBITDA reconcile monthly and annually | ✅ Pass | Each month: GP = revenue − COGS, EBITDA = GP − opex. Annual: Σ category GP, Σ opex accounts, EBITDA = GP − opex, KPI cards equal the tables, margins = metric ÷ revenue. |
| 3 | Each assumption changed on its own (incl. 0 and negative) | ✅ Pass | All-zero reproduces FY2025 exactly. Unit growth +10 % / −10 % / −50 % and price ±5 % for each category, each opex account at +10 % / −10 % / 0 %. Only the intended lines move; EBITDA moves by exactly base × change for opex. |
| 4 | Monthly forecast reconciles to annual totals | ✅ Pass | Σ months = annual for revenue, GP, opex, EBITDA, and chart data. |
| 5 | Gross margin assumptions are percentage points | ✅ Pass | +2 pp gives GM_base + 0,02 (tested to differ from GM × 1,02). Applied in every month; the URL `margin=1.5` parses to 0,015. Input is labelled "pp". |
| 6 | Seasonality preserved | ✅ Pass (limitations below) | Each category's monthly share of annual revenue is identical to FY2025 to 1e-12. Company-level shares shift only through category mix (tested). |
| 7 | Shared URL reproduces assumptions | ✅ Pass | Round-trip through the exact link format (commas unescaped): defaults, mixed, the bounds (−50 % … +100 %, ±20 pp) and fine steps such as 3,33 % and 0,01 %. Rebuilt EBITDA is identical. |
| 8 | Regression tests | ✅ Added | 59 tests in `forecast.regression.test.ts`. |

## Issues found and fixed

| ID | Severity | Issue | Fix |
|---|---|---|---|
| QA-1 | Medium (data integrity) | A month with zero base revenue but COGS > 0 had its COGS silently set to 0, which breaks the "missing ≠ 0" rule. It can't happen with the current seed data, but could with imported data (M5). | COGS is kept and scaled with unit growth (cost per unit unchanged); revenue stays 0. |
| QA-2 | Medium (formula rule) | Base revenue with zero units (no ASP) was still forecast, so revenue ≠ units × ASP. Not present in the seed data. | Returns `null` ("n/a"). An invalid base can't produce an invented forecast. |
| QA-3 | Low (presentation) | In "Show formulas", recomputing from the displayed rounded inputs differs from the displayed result by up to 2.111 kr. on full-year revenue (ASP shown to 2 decimals). The engine itself is exact. | Note added under the formula view explaining that inputs are rounded for display only. |

No issues found in checks 1–7 on valid data.

## Limitations (documented, not changed)

- **Seasonality is copied from FY2025.** One-offs in FY2025 carry into FY2026 unless the user
  adjusts for them, e.g. the weak fashion spring and the November marketing overspend.
- **No calendar effects.** The forecast ignores Easter timing, trading days and Black Friday dates.
- **Drivers apply evenly to all 12 months.** There is no phasing, such as a price increase from April.
- **Forecast units are not rounded to whole units.** Rounding would break revenue = units × ASP
  exactly. They're displayed rounded.
- **Company-level ratios move with mix.** If one category grows faster, company gross margin
  changes even with a 0 pp margin assumption. This is correct mix behaviour, not an error.
- **Margin is clamped to ±20 pp from base.** A base margin above 80 % plus +20 pp could exceed
  100 %. Not reachable with the current data (category margins 45–57 %).

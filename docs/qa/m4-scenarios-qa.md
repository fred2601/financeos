# QA review — Milestone 4 (scenario simulator)

Date: 2026-11-11 · Scope: `src/lib/finance/scenarios.ts`, `src/lib/selectors/scenarios.ts`,
scenarios page. The simple three-lever model is kept as-is. There are no architectural
changes, and the interface changed only in sensitivity wording.

Automated tests: `src/lib/selectors/scenarios.regression.test.ts` (32 tests). Full suite:
**176 tests passing**.

## Results

| # | Check | Result | How it was tested |
|---|---|---|---|
| 1 | All three scenarios reconcile revenue → EBITDA | ✅ Pass | Full year compared with an **independent** calculation built from the FY2025 base months (not from the view-model): revenue, GP, opex, EBITDA, margins. Every month: revenue = base × (1 + s), EBITDA = revenue − COGS − opex. Σ months = year. Cards, table and charts show identical numbers. |
| 2 | Sensitivities vs independent formulas | ✅ Pass, ⚠️ label issue (fixed) | For each preset: analytical derivatives *and* finite differences on the full monthly engine agree to 0,001 kr. Linearity checked. |
| 3 | Zero, negative and extreme inputs | ✅ Pass | 7 lever sets incl. all bounds, "collapse" (−50 % sales, −20 pp, +100 % opex → EBITDA −337,9m) and "boom". Engine = closed form = independent; no NaN/Infinity; losses shown as negative and unfavorable. Gross margin stays within 0–100 % in every month at ±20 pp. Ordering warning: fires only when out of order; ties don't trigger it. |
| 4 | URLs reproduce all inputs | ✅ Pass | Presets, all bounds and fine steps (e.g. −3,33 %, 0,01 %) round-trip exactly and rebuild identical EBITDA. Encoded commas, a leading `+`, missing scenarios and out-of-range values (clamped) handled. |
| 7 | Regression tests | ✅ Added | 32 tests. |

## Issues found

| ID | Severity | Finding | Action |
|---|---|---|---|
| QA4-1 | Low (labelling) | The sensitivity panel said "+1 % sales growth" and "+1 % operating expenses". The calculation raises the **lever by 1 percentage point** (e.g. 4 % → 5 %), which equals 1 % of the *FY2025* amount, not 1 % of the base-case amount. Read the other way the values would be 2,52m vs the shown 2,42m (sales) and −2,12m vs −2,06m (opex). | **Fixed.** Labels now read "Sales growth +1 pp", "Gross margin +1 pp" and "Opex change +1 pp", with a one-line explanation. Formula doc corrected. |
| QA4-2 | Info (modelling convention) | In the forecast engine, a price change with 0 pp margin change keeps the margin % constant, i.e. costs are assumed to rise with prices. In the Budget vs actual bridge, price flows 100 % to gross profit. Both are valid, but the difference wasn't written down. | **Documented** in ARCHITECTURE.md (price convention). No behaviour change. |

No calculation bugs were found.

## Why the Forecast page and Scenario simulator give different FY2026 base cases

Both start from FY2025 actuals and use the same engine. They differ only because **their
default assumptions differ in shape**:

| Line | FY2025 actual | Forecast (defaults) | Scenario base case | Difference |
|---|---|---|---|---|
| Revenue | 467,4m | 487,4m (**+4,29 %**) | 486,1m (**+4,00 %**) | +1,33m |
| Gross margin | 51,85 % | 51,83 % | 51,85 % | −0,01 pp |
| Gross profit | 242,3m | 252,6m | 252,0m | +0,62m |
| Opex | 206,1m | 212,7m (**+3,16 %**) | 212,3m (**+3,00 %**) | +0,33m |
| **EBITDA** | **36,2m** | **40,0m** | **39,7m** | **+0,29m** |

1. **Revenue: +4,29 % vs +4,00 %.** The forecast compounds volume and price per category:
   (1 + 2 %) × (1 + 2 %) = +4,04 % for Home & Living and Fashion, and (1 + 3 %) × (1 + 2 %) =
   +5,06 % for Outdoor & Sport. Weighted by revenue, that's +4,29 %. The scenario applies a
   flat +4,00 % to everything.
2. **Gross margin: −0,01 pp vs 0 pp.** Outdoor & Sport has the lowest margin (45,8 %) and
   grows fastest in the forecast, which pulls the company margin down slightly. That's a mix
   effect, even though every category's own margin is unchanged. The scenario grows all
   categories equally, so there's no mix effect.
3. **Opex: +3,16 % vs +3,00 %.** The forecast uses a rate per account (personnel 3,5 %,
   IT 5 %, rent 2 % …), and weighted by cost that's +3,16 %. The scenario uses one 3,0 % rate.

The EBITDA gap is exactly the GP gap minus the opex gap (0,62 − 0,33 = 0,29m, tested). Neither
number is wrong. They are two different sets of assumptions, and the page footers say so.

## Limitations (unchanged, documented)

- **Sales growth is pure volume** at unchanged price and mix. It doesn't split into price and volume.
- **One opex rate for all accounts, and costs don't flex with sales.** In the worst case,
  logistics and marketing don't fall when sales fall.
- **Scenarios are independent of the Forecast page.** Editing the forecast doesn't move the
  scenario base case.

---

## Proposal: integrate the scenario base case with the driver-based forecast (future iteration)

**Goal:** one planning truth. The scenario *base case* **is** the driver-based forecast, and
worst/best are expressed as **deltas on top of it**. Then the two pages can never disagree.

### Design

1. **A shared plan object.** Make `ForecastAssumptions` the base case. A scenario becomes an
   overlay:
   ```ts
   interface ScenarioOverlay {
     salesGrowthDelta: number;   // pp added to every category's unit growth
     priceDelta: number;         // pp added to every category's price change (optional new lever)
     marginDelta: number;        // pp added to every category's margin change
     opexDelta: number;          // pp added to every opex account's growth
   }
   applyOverlay(forecast: ForecastAssumptions, o: ScenarioOverlay): ForecastAssumptions
   ```
   Base case = overlay of zeros, so it is identical to the Forecast page by construction.
   Worst/best presets become deltas, e.g. worst = −7 pp sales, −1,5 pp margin, +1,5 pp opex.
2. **Carry assumptions between pages.** The Forecast page's query string (`units=…&price=…`)
   is passed to the Scenarios page link. Scenario overlays add `worst=…&best=…`. The pages
   stay server-free, and links stay shareable.
3. **Generalise the closed form.** With overlays per category, the full-year EBITDA becomes
   Σ_c (1 + g_c + Δs)(1 + p_c)(GP_c,0 + (m_c + Δm) × Rev_c,0) − Σ_a (1 + o_a + Δo) × Opex_a,0.
   This keeps an exact formula panel and analytical sensitivities.
4. **Optional realism step (separately approved): variable costs.** Mark logistics and part
   of marketing as variable (cost per unit or % of revenue), so costs flex with volume in
   the worst/best cases.

### Plan and safeguards

| Step | Effort | Safeguard |
|---|---|---|
| Add `ScenarioOverlay` + `applyOverlay` in `lib/finance/scenarios.ts` | ~1 h | Unit tests: a zero overlay equals the forecast exactly |
| Switch the view-model to overlays; keep the current URL format readable (migrate old links to the equivalent overlay) | ~1–1,5 h | The QA4 regression tests are adapted. Old links still parse. |
| Pass forecast assumptions in the Scenarios link and show "Base case = your forecast" | ~0,5 h | Test: forecast EBITDA = scenario base-case EBITDA for random assumption sets |
| Generalised closed form + sensitivities | ~1 h | Finite-difference tests on the engine (as in QA4) |
| (Optional) variable cost drivers | ~2 h | New tests; needs a decision on which accounts are variable |

Total ≈ 3,5–4 h without variable costs. **Trade-off:** the scenario page becomes slightly
harder to explain ("deltas vs your forecast" rather than "growth vs FY2025"), but every
number in the app then ties back to one set of assumptions. A finance audience expects that
from a planning tool.

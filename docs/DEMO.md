# FinanceOS: demo script (5 minutes)

For interviews with CFOs, finance managers and employers. Open each link in a new tab
before you start. All figures below come from the fictional dataset and match the live site.

Base URL: https://financeos-kappa-nine.vercel.app

---

## 0. Opening line (15 s)

> "FinanceOS is an FP&A tool I built for a medium-sized Danish retailer. It covers the monthly
> close review, budget variance analysis, forecasting and scenarios, plus an AI analyst that is
> not allowed to make up numbers. The company and data are fictional, but the accounting logic
> is real and fully tested."

## 1. Executive dashboard (45 s)

**Open:** `/dashboard?period=2025-11&view=month`

- "November 2025: revenue 49,6 mio. kr., +7,6 % against budget, and EBITDA 5,8 mio., +25 %."
- Click **Year to date** and point out that the comparison switches to the prior year automatically.
- Point at the colours: *"Green and red follow the account, not the sign. If costs come in
  above budget, that's red, even though the number is positive."*
- Point at a grey chip: *"Small variances below 1 % or 50 t.kr. count as on budget, so
  management isn't distracted by noise."*

## 2. Budget vs actual (90 s), the core FP&A story

**Open:** `/variance?period=2025-11&view=ytd`

- **EBITDA bridge:** *"Year to date we're 1,5 mio. ahead of budget. The bridge shows how we
  get from budget to actual: volume and mix add 4,0 mio., price costs 2,0 mio., and
  marketing is 0,8 mio. over."*
- **Price/volume/mix:** scroll to *Revenue analysis*. *"Revenue is +6,7 mio. That splits into
  +6,4 from volume, +2,3 from mix and −2,0 from price. The average price is almost on budget,
  but only because we sold more of the expensive categories, which hides real price cuts. A
  plain variance wouldn't show you that."*
- **Largest variances:** *"Ranked by EBITDA impact. Number one is Fashion in stores,
  −4,1 mio."*
- **Filter:** set Category = Fashion and Period = Apr 2025 (Month). Revenue is −17,8 % and
  margin −3,8 pp, with both volume and price negative.

## 3. Forecast (45 s)

**Open:** `/forecast`

- *"FY2026 is built bottom-up, month by month: units × price per category, margin in
  percentage points, and cost growth per account."*
- Change **Home & Living unit growth** from 2 % to 6 %. Everything updates instantly.
- Click **Show formulas**: *"Every number can be traced to its formula, using the actual
  values."*
- Click **Copy link**: *"The assumptions travel in the URL, so I can send a colleague exactly
  this forecast."*

## 4. Scenarios (45 s)

**Open:** `/scenarios`

- *"Worst, base and best case: EBITDA 12,8 / 39,7 / 56,5 mio."*
- Point at **Sensitivity**: *"One percentage point of gross margin is worth 4,9 mio. of EBITDA,
  twice as much as one point of sales growth (2,4 mio.). For a retailer, margin discipline
  is the biggest lever."*
- Optional: lower Best case sales growth until the **ordering warning** appears.

## 5. AI analyst (60 s)

**Open:** `/analyst?period=2025-11&view=ytd`

- Point at the **fact sheet** first: *"These 38 figures are the only thing the model sees.
  They're computed by the same tested engine."*
- Tick consent and click **Generate analysis**. It takes 20–30 seconds, so keep talking: *"The
  model has to refer to figures by id. If it writes a number itself, the server throws that
  sentence away. So it can be wrong in interpretation, but it physically cannot change a
  number."*
- Point at the three sections: *"Facts, hypotheses and recommendations are separated. Each
  hypothesis says how to verify it."*

## 6. Close (15 s)

> "Under the hood, every calculation is a pure function with 205 automated tests, including
> two financial QA reviews with independent reconciliations. If I took this further, I'd add
> CSV/Excel import of real ledger data, and link the scenario base case directly to the forecast."

---

## Likely questions and good answers

**"Why is percentage variance divided by the absolute budget?"**
If the budget is a loss of −1 mio. and actual is −0,5 mio., you're 0,5 mio. better. Dividing by
−1 would show −50 % and look worse. Dividing by |budget| gives +50 %, matching the intuition.

**"How do you decide favorable vs unfavorable?"**
By account direction: revenue and profit are higher-is-better, costs lower-is-better. Then
materiality: below 1 % *and* 50 t.kr. (0,1 pp for margins), a variance counts as on budget.

**"Why don't the Forecast and Scenario base cases match exactly?"**
They're two different sets of assumptions on the same engine. The forecast compounds volume
and price per category (+4,29 % revenue) and uses cost growth per account (+3,16 %). The
scenario applies a flat +4 % / +3 %. The 0,29 mio. EBITDA gap reconciles exactly (see
`docs/qa/m4-scenarios-qa.md`). The next iteration would make the scenario base case *be* the
forecast.

**"In the forecast, does a price increase go straight to profit?"**
No. With a 0 pp margin change, the margin % stays constant, so costs are assumed to rise with
prices. If you expect the price increase to stick without higher costs, add it via the margin
lever. The budget-vs-actual bridge, which analyses history, counts price at 100 %. Both are
documented choices.

**"Is EBITDA here IFRS 16?"**
No. Rent is an operating expense: a management view before IFRS 16. Under IFRS 16, most rent
would sit below EBITDA, so EBITDA would be higher.

**"How do you know the numbers are right?"**
The calculations are separated from the UI and tested against hand calculations and
independent recomputations. Revenue always equals units × price; the price, volume and mix
effects add up exactly to the total variance; monthly figures add up to the year. 205 tests
run before every commit.

**"Isn't sending financial data to an AI risky?"**
Only aggregated figures from the fact sheet are sent, after explicit consent, and the API key
stays on the server. For real company data I'd add an approval step and check the data
processing terms first. The demo uses fictional data only.

**"What would you do with more time?"**
CSV/Excel import with validation, integrating scenarios with the driver-based forecast,
variable cost drivers (logistics and marketing that flex with volume), and a cash-flow view.

---

## Before a demo: checklist

- [ ] Live site loads (dashboard, variance, forecast, scenarios, analyst)
- [ ] Anthropic spend limit has headroom, and the analyst returns a summary
- [ ] Browser zoom at 100 %, window ≥ 1280 px wide
- [ ] Tabs opened in the order above

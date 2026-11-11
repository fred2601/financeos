# Production readiness review — FinanceOS

Date: 2026-11-11 · Live: https://financeos-kappa-nine.vercel.app · Repo: https://github.com/fred2601/financeos

Scope: the nine review areas requested before the portfolio launch. No new features or
redesign; verified issues were fixed, and everything else is listed under limitations.

## Result

**Ready for portfolio launch.** I found 9 verified issues and fixed all of them. Automated
checks: **216 / 216 tests passing**, TypeScript strict passes, ESLint passes with 0 problems,
and the production build succeeds. Production dependencies: **0 known vulnerabilities**.

## 1. AI analyst end-to-end in production

| Path | How it was checked | Result |
|---|---|---|
| Successful analysis | Live call for YTD Nov 2025 | ✅ 200, figures match the app, 0 statements rejected |
| Loading state | UI shows a spinner and "usually takes 15–40 seconds"; the button is disabled while running | ✅ |
| Missing API key | Live, before the key was set | ✅ 503 "not configured"; the page still shows the fact sheet |
| Invalid input (bad period, extra field, not JSON) | Live requests | ✅ 400 with a clear message |
| Wrong method | Live GET | ✅ 405 |
| Model refusal, truncation, unparseable output | Route tests with a mocked model | ✅ 502, nothing cached |
| SDK timeout / API error / network error | Route tests | ✅ 504 / 502, no internal details leaked |
| Non-JSON response from the platform (e.g. timeout page) | Code review → **fixed** | ✅ shown as a readable error instead of "could not reach the server" |
| Repeat requests | Live → **issue found**: each repeat hit a new server instance and was billed again | ✅ fixed with a shared `use cache: remote` cache. Live after the fix: 1st call 12,4 s (`cached: false`), 2nd call **0,6 s** (`cached: true`, same `generatedAt`) |
| Cross-site / wrong content type | Live after the fix | ✅ `text/plain` → 415, foreign `Origin` → 403 |

## 2. AI grounding: facts vs hypotheses vs recommendations

Already enforced: figures only via `{{F#}}` placeholders from the fact sheet. Any digit or
number word, unknown id, or uncited "fact" is removed.

**Added in this review**, applied to facts and the summary:
- statements that state a cause ("because", "due to", "driven by", …) are removed, because
  causes belong in hypotheses;
- statements that call a figure *favorable* or *unfavorable* must cite at least one fact with
  that status.

Checked against the real live output from earlier: 7 / 7 facts still pass, so a good analysis
isn't over-filtered. In the UI, facts, hypotheses (each with "to verify") and recommendations
sit in separate, labelled sections, with a note that hypotheses and recommendations are
suggestions.

## 3. Materiality: misleading classifications

Scanned all 1.344 amount comparisons (24 months × month/YTD × KPIs, accounts, cost lines).
**Issue found:** 17 large variances were labelled "On budget" because their % was under 1 %.
The clearest is **FY2024 revenue, −2,55 mio. kr. (−0,6 %)**, shown as on budget in a year
when EBITDA missed by 3,5 mio. kr.

**Fixed:**
- Variances ≥ **1 mio. kr.** are always material. The rule is now (≥ 50 t.kr. AND ≥ 1 %) OR ≥ 1 mio. kr.
- The neutral label "On budget" is renamed **"Within threshold"**, since a small variance isn't
  exactly on budget.
- Price/volume/mix facts sent to the AI now use the same materiality.

A regression test covers the FY2024 case.

## 4. Navigation

The dead "Soon" / "Coming in a later milestone" code path is removed from the sidebar, and all
five modules link normally. An unused in-memory cache was removed too.

## 5. Mobile, accessibility, usability

- Checked at 375 px, 768 px and 1440 px. Fixed: AI fact-sheet values were clipped on phones
  and now wrap.
- Headings: **issue found**: pages went from `h1` straight to `h3`, because card titles were plain
  `div`s. Fixed: card titles and KPI labels are now `h2`.
- Verified: a skip link, a `main` landmark, labelled navigation, `lang="en"`, focus rings on
  custom controls, every chart with a text alternative (sparklines hidden as decorative), and
  all inputs labelled. The Base UI Select's hidden form input is `aria-hidden` and not
  focusable.
- An automated axe-core scan wasn't run. Loading it from a CDN was blocked by the session's
  safety settings, so a manual DOM audit was used instead.

## 6. Automated checks

| Check | Result |
|---|---|
| `npm test` (Vitest) | 216 passed, 0 failed, 13 files |
| `npm run typecheck` | passes |
| `npm run lint` | 0 problems |
| `npm run build` | succeeds |
| `npm audit --omit=dev` | 0 vulnerabilities (the 6 low/moderate findings were in the `shadcn` CLI, now a dev dependency) |

## 7. README

Rewritten with purpose, an architecture diagram, financial methodology, security, screenshots,
quality, setup, known limitations and the live demo URL.

## 8. Fictional data labelling

- Every module page shows a **"Fictional data"** badge.
- The sidebar says "Fictional demo company".
- The page footers say "All data is fictional".
- The seed file carries `fictional: true`, which the schema requires.
- The AI prompt states "fictional demo data", and the README and DATA.md say so explicitly.

## 9. Security

| Area | Finding | Status |
|---|---|---|
| API key | Read only in the server route; none of the client bundles contain the key name, a key or the API host | ✅ |
| Cross-site cost abuse | **Issue:** `/api/analyst` accepted `text/plain` POSTs, which any website can send from a visitor's browser | ✅ fixed: only same-origin `application/json` (415 / 403 otherwise) |
| Input validation | Strict Zod schema; URL params clamped; no user free text reaches the model (no prompt-injection surface) | ✅ |
| Error leakage | Generic messages; no stack traces or upstream details | ✅ |
| Security headers | **Issue:** only HSTS was set | ✅ added nosniff, referrer policy, framing denial (`X-Frame-Options` + `frame-ancestors`), permissions policy; `X-Powered-By` removed |
| Dependencies | 6 low/moderate findings in the dev-only `shadcn` CLI | ✅ moved to devDependencies |
| Secrets in git history | Scanned before the repo went public: no keys, no personal email, only `.env.example` | ✅ |

## Unresolved limitations (accepted for a portfolio demo)

1. **No strict Content-Security-Policy.** Next.js inline scripts would need nonces; only
   `frame-ancestors` is set.
2. **The rate limit is per server instance.** The shared result cache and the Anthropic spend
   limit are the effective cost controls. A global limit would need a store such as Redis.
3. **The AI wording checks are heuristic.** They catch numbers, unknown ids, causal words in
   facts and favorable/unfavorable mismatches, but not every possible misstatement.
   Hypotheses and recommendations remain suggestions.
4. **Materiality thresholds are company-wide**, not per account, department or period length.
5. **The scenario base case is independent of the Forecast page.** The difference is
   documented, and an integration proposal is in `m4-scenarios-qa.md`.
6. **No CSV/Excel import yet** (roadmap M5). The app only shows the fictional dataset.
7. **No automated axe-core scan.** See section 5.

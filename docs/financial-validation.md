# Financial review and release validation

Verified: 9 November 2026 (Asia/Calcutta). Website v0.5.0; calculation version 0.2.0; research workflow `deterministic-research-2`. No paid APIs, model keys or new dependencies.

## Completed behavior

Historical review and DCF suitability are separate. A user can load supported annual facts, inspect ratios and run all three workers while DCF explains why it is withheld. `src/lib/review.ts` applies the same source-review rules in the browser and on the server. `valuationReadiness` in the finance library applies the same dataset restrictions to the UI and workers.

**Review mappings** on Sources or Valuation reopens source inputs and their notes. Sourced values are preserved; missing/conflicting inputs accept a manual number with a filing/note reference and definition. Previous manual entries can be revised or cleared. Clearing restores an unavailable status, not a stale number. Source changes invalidate research results and forecast approval. Automatically seeded assumptions update if their source basis changes; user-edited forecast assumptions remain for separate review.

A separate suitability check and at least 20 characters of accounting-scope rationale are needed before SEC DCF. This covers the operating-company model, common-shareholder scope, leases and consistency of EBIT, D&A and CapEx. Non-demo forecasts also require a written assumption rationale and explicit approval. Explain growth, margins, tax, reinvestment, WACC, terminal growth, cash and claims using source/as-of dates. Text length is only a usability requirement, not automated verification that a rationale is sound.

The latest historical revenue, operating EBIT, D&A, CapEx, operating NWC and debt must be available. Enter zero only when supported by the statements. Historical common earnings/equity are needed for their ratios but not for an unlevered operating forecast. Public/private per-share values remain withheld. A saved SEC snapshot cannot bypass refresh by directly invoking the research functions.

Valuation is explicitly **as of the latest fiscal year-end**, with the first forecast year following it. This is a defensible historical model; it is not a valuation rolled forward to today's market price. All non-demo assumptions require review, even if seeded from history.

## Finance checks and independent answers

- Twelve ratios checked against a hand-worked statement: gross margin60%, operating margin20%, common net margin12%, current ratio2, quick ratio1.2, debt/equity0.5, net debt/EBITDA1, interest coverage8, ROE16%, ROA120/1900, cash conversion1.5, CFO−CapEx100. Average-balance returns require adjoining dates, matching units and positive opening/closing balances; losses remain signed.
- FCFF example: EBIT100 × (1−25%) + D&A10 − CapEx20 − ΔNWC5 =60. Cash released by falling or more-negative operating NWC increases FCFF.
- Flat perpetuity: annual FCFF100 / WACC10% = EV1000. Add excess cash50 and subtract debt200: equity850; divided by 100 synthetic shares =8.50.
- Growing perpetuity: first-year NOPAT157.5 + D&A42 − CapEx63 − ΔNWC5 = FCFF131.5. With 5% perpetual growth and 10% WACC: EV2630; cash20 + other assets10 − debt300 − other claims30 gives equity2330 and23.30 per 100 synthetic shares.
- Independent two-stage example: annual FCFF111,122.1,134.31,147.741,162.5151. Year-six FCFF177.478202 is derived from explicit 2% terminal growth, rather than multiplying year-five FCFF by 1.02. Discount years1–5 individually and the year-five terminal value `177.478202/(10%−2%)` by five years. Production results match.
- A deterministic grid of nine growth/WACC combinations checks unit scaling, invariant per-share values when shares scale too, lower EV at higher WACC, and lower EV at higher CapEx. Assumptions remain immutable.
- WACC must exceed terminal growth. Positive terminal growth requires positive reinvestment. Negative terminal reinvestment is rejected even at zero growth: the stable model cannot rely on perpetual asset liquidation. Undefined stable ROIC remains unavailable.
- Ratios/CAGR and DCF reject nonfinite results, including overflow in intermediate forecast fields or per-share calculations. Charts use the same ratio engine. Positive excess cash requires a known reported cash balance and cannot exceed it. A negative residual equity value is labelled a shortfall, not a tradable negative share price.
- Statement checks reject current assets/liabilities above consolidated totals and overlapping cash/investment/receivable totals above current assets. For confirmed no-preferred/no-NCI scope, assets must reconcile to liabilities plus common equity. Shared checks tolerate one USD-million displayed unit or 0.1% of the relevant total. Existing cash≤current-assets checks remain stricter. SEC consolidated-equity reconciliation has its existing USD 1/0.1% tolerance. These are mapping checks, not audit assurance; a full cash-movement reconciliation is still outside this release.

## Tests actually run

- 76 unit/API tests across 9 suites passed in normal order, then again in shuffled order with seed 1704. Earlier 64-test baseline also passed during implementation.
- 15 Chromium browser cases passed twice consecutively: 30 successful executions. These cover desktop/mobile, accessibility, CSV privacy, historical review without DCF, source evidence, manual mappings and deletion, scope/rationale gates, scenario/assumption invalidation, session save/restore/refresh and exported numerical agreement.
- The new end-to-end case initially used the wrong test locator “Debt” for the existing “Interest-bearing debt” label. The saved browser snapshot established the UI value was 300. Corrected the test locator; the targeted rerun and both complete repeated runs passed. No test was skipped or weakened to conceal a failure.
- TypeScript, frontend/server production build and formatting checks passed. Existing generated server output is cleared before build.
- The compiled production app on a separate local port completed a real Microsoft lookup, accepted historical review only, displayed five years, called the actual research API, rendered all three workers and exported a report. FY2026 operating margin matched 155237/331839 =46.7808184%; DCF remained withheld. Browser errors: 0. No requests were mocked in this production check.

## Live statement evidence

Microsoft: live 3-,5- and7-year retrieval/mapping passed with no annual-history blockers. The previously reconciled 60 populated figures across FY2022–FY2026 remain unchanged. Original sources/fingerprints are in [Microsoft validation](live-sec-validation.md).

Apple: live 3-year retrieval/mapping passed for years ended2024-09-28,2025-09-27 and 2026-09-26. Compared all 36 populated inputs to original consolidated statements in its 2024 and 2026 10-Ks, using comparative columns. All matched in USD millions: revenue, gross profit, operating income, D&A, cash CapEx, CFO, total assets/liabilities, current assets/liabilities, cash and trade receivables.

This brings selected-field reconciliation to 96 values across two issuers. It does not prove every SEC concept, issuer or manual mapping is correct. No real-issuer DCF was approved: a reliable system must withhold unsupported conclusions.

Apple examples demonstrate why accounting review matters: its current marketable securities are not automatically substituted for a different supported tag; vendor non-trade receivables remain distinct from the mapped trade-receivable field; capital investment below D&A in a historical year does not automatically justify perpetual asset liquidation. The UI supplies manual-definition guidance instead of guessing.

Validation artifacts are under `/workspace/scratch/release-v05/`: live histories, normalized mappings, Apple original HTML and table extracts, comparison records, production report and screenshots. Original disclosure links and SHA-256 fingerprints follow below.

## Remaining scope

The first-release website is usable for reviewed historical research and supported driver-based DCF scenarios. Private financial input is CSV in USD millions; arbitrary Excel/PDF/OCR ingestion, verified current capitalization, market-price feeds, qualitative investment theses, sector-specific valuation and public deployment are not implemented. No authentication or multi-user service is claimed. User review cannot be eliminated by repeating tests, and testing cannot guarantee the absence of all bugs.

Interview explanation: “I independently verified the arithmetic, preserved statement evidence and separated data acceptance from valuation suitability. When accounting definitions are unresolved, I show the analysis I can support and withhold the affected output.”

## Apple source fingerprints

Company Facts: https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json

Retrieved `2026-11-09T16:32:15.355Z`; SHA-256 `f085735b4d08fb116ade18d24247ffabe11df8eb52eae6556b165831f15ef1ad`.

- [2026 original Apple 10-K](https://www.sec.gov/Archives/edgar/data/320193/000032019326000026/aapl-20260926.htm): SHA-256 `26f653329048525930ff2f4983ece2e2ec57a69b36b377dd1f0abcb61f331402`.
- [2024 original Apple 10-K](https://www.sec.gov/Archives/edgar/data/320193/000032019324000123/aapl-20240928.htm): SHA-256 `c7c799b5231e471edd4ce5033395adbfc329e433e29dc69d91a2cb7af8b6cd26`.

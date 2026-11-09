# Implementation milestones

Status: first website milestone completed on 29 October 2026. CSV import and parts of the research-report milestone are also implemented. Remaining integrations are listed below. Read the [architecture and finance guide](architecture-and-interview-guide.md) for definitions and scope.

## 1. Calculation-first website — completed

Implemented React + TypeScript + Vite, an npm lockfile, Zod-validated CSV rows, a documented CSV template/review screen, and responsive overview/financials/valuation/sources screens. Synthetic non-financial-company data supports three to seven displayed annual periods plus opening balances. The pure TypeScript library implements ratios, a five-year FCFF forecast, explicit year-six terminal drivers, model guards, and the EV-to-equity bridge. No LLM is required.

Acceptance checks:

- A reviewed synthetic dataset produces known-answer ratio and DCF outputs, visible charts, and editable assumptions.
- Tests cover the FCFF example of 60 and equity-value example of 850 in the guide; average balances, fiscal intervals, scale/sign handling, and unavailable inputs have substantive cases.
- Tests reject WACC at/below terminal growth, incompatible periods/currencies, and materially incomplete valuation inputs.
- Raising CapEx lowers FCFF; raising WACC lowers value for a fixed positive-cash-flow fixture; adding debt lowers equity value with EV held fixed.
- Users can see calculation inputs and export a research result without a model-provider credential.

## 2. Public filings and richer private inputs — mapping and initial live reconciliation verified

SEC discovery, 3–7-year annual normalization, retained source candidates, manual mappings with rationale, fiscal comparability checks and the website review gate are implemented. Synthetic fixtures exercise them. Live Microsoft retrieval now works: 60 populated inputs across five years match original statements. Missing inputs and valuation-scope review remain unresolved; see [verification](live-sec-validation.md). Private CSV works; Excel/PDF and automatic custom-tag mapping remain later work.

Acceptance checks:

- One suitable real public company has at least three reconciled annual periods, and requested five/seven-year behavior is tested with fixtures.
- A sample of accepted facts is checked against the original statements; the UI exposes the same sources.
- Duplicate facts, restatements, missing years, a transition year, and unavailable opening balances have tested outcomes.
- A private upload reaches the same calculation engine after review; missing required fields block the affected outputs without fabricating values.
- SEC rate limiting, timeout handling, and cached re-runs are exercised. Automated unit tests do not depend on live SEC availability.

## 3. Three rule-based research workers — implemented

The user requires no paid APIs or model keys. Reports, fundamentals and DCF now execute fixed shared TypeScript tools. Sample/private research runs locally; public research rechecks SEC sources on the server. Removed OpenAI integration and model selection. All evidence is returned, with workflow/calculation versions and an input hash. These are deterministic workers, not autonomous LLM agents.

Acceptance checks completed with fixtures and local workflows:

- Each role produces its defined evidence and trace without a provider.
- Identical inputs produce identical numerical results and evidence.
- Private research makes no server upload; public requests reject arbitrary private datasets.
- Missing inputs, unapproved assumptions, sector blocks and changed sources remain explicit.
- No model key, paid data service or inference request is used.

## 4. Research report — partially implemented

Scenario editing, sensitivity, the equity bridge, source/assumption tables, CSV/report exports and portable Save/Open sessions are implemented. Versioned local session files restore inputs and recompute outputs; private DCF approval resets, and SEC snapshots require source refresh before valuation/research. No database or autosave is needed. Polished document export and reviewed PDF extraction remain future work.

Acceptance checks:

- A full company-research walkthrough runs from source selection to evidence-backed output.
- Changing an assumption invalidates and recomputes downstream results while preserving the historical facts; outputs cannot mix two runs.
- Restarting the application retains saved data and assumptions, with no requirement that old processes survive.
- A saved run can reproduce its numerical results, and the interview guide describes the actual implementation, tests, costs, and known limitations.
- Private files, credentials, and generated company reports are excluded from Git.

## Later, only when justified

Add Indian-market ingestion/Ind AS mapping, foreign issuer support, peer valuations with a licensed price source, detailed financial schedules, OCR, sector-specific models, and shared-user deployment as separate increments. Broad feature coverage should follow trustworthy evidence and calculations.

The next implementation priority is separating historical review from valuation scope, followed by defensible manual mapping for unresolved inputs. Initial live SEC retrieval and selected-field reconciliation passed on 9 November. No model credential or live-model test is required. Describe the three roles as rule-based workers on the CV, and distinguish synthetic test coverage from real issuer validation.

## Verified first-release evidence

- 26 unit tests pass for financial formulas, economic sensitivities, source references, and CSV validation.
- Six Chromium browser tests pass, including a 390px mobile workflow, CSV review/export, invalid-valuation removal, and automated overview accessibility checks. Additional A/AA scans passed on the other three screens.
- TypeScript and the production build pass. Source formatting is standardized with Prettier.
- Sample and private-import workflows work without an LLM credential. No real public-company financial integration has been validated yet.
- The website has no persistent storage: reload clears the session, and JSON export is a record rather than a restorable session.
- Google Doc updates remain pending tool access; the supplied document ID and local guide are preserved in `WORKLOG.md`.

## Step 1 checkpoint — 2 November 2026

The Node SEC server, ticker/CIK lookup, annual report/amendment discovery, bounded proxy-aware client, and fingerprinted raw-facts download are built. 45 unit/API tests and 8 browser tests pass; SEC fixtures are synthetic. Live access is not established: the environment proxy refused both SEC hosts with CONNECT 403, and SEC_USER_AGENT is absent. The required configuration is saved in the draft. See `sec-integration.md` for setup and `npm run check:sec`. No live SEC values feed the valuation yet.

## Step 2 and agents checkpoint — 3 November 2026

61 unit/API and 11 browser tests passed, including reviewed SEC fixture imports, accounting contexts/restatements, agent restrictions, calculation-only HTTP research and stale-run invalidation. The TypeScript production build passed. The model adapter is implemented but has no live key; SEC network access remains blocked after contact configuration. The selected five-year default and three-to-seven-year cap apply to research runs. Updated local interview guide and checkpoint; Google Doc sync remains pending connector access.

## Cost-free workflow and sessions checkpoint — 7 November 2026

Removed the paid model integration at the user's explicit request. Implemented local private research and versioned Save/Open sessions with strict validation, recalculation and public-source refresh gates. 64 unit/API and 14 browser tests passed; TypeScript production build passed. The lower unit-test count than the interim session branch reflects removal of the obsolete provider tests, not skipped checks. The SEC network check still fails. Google Doc tools remain unavailable; local interview notes and resume checkpoint are maintained.

## Live SEC checkpoint — 9 November 2026

Environment publication resolved access. Live discovery, normalized source review and 60 original-statement comparisons passed for Microsoft FY2022–FY2026. No model key is required. This validates retrieval and the populated mappings for one issuer; remaining accounting inputs and Microsoft DCF are not approved. Earlier checkpoints preserve their results as of their dates.


## v0.5 review completion and financial audit — 9 November 2026

Implemented separate historical/DCF suitability gates, shared source-review validation, editable manual mappings, explicit assumption rationale, fiscal-year-end valuation dating and stricter numerical/statement checks. Independently audited all 12 ratios and multiple DCF examples.76 unit/API tests passed twice (normal/shuffled);15 browser cases passed twice (30 executions). Compiled production live Microsoft research passed with unsupported DCF withheld.96 mapped figures across Microsoft/Apple match original statements. See [financial validation](financial-validation.md) for full evidence and boundaries. This completes the first-release review/hardening scope, not deferred Excel/PDF, market feeds, capitalization verification or deployment.

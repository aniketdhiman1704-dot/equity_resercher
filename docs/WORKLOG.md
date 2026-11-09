# Development checkpoint

Updated: 7 November 2026 (Asia/Calcutta). Continue `/workspace/equity_resercher`; do not restart or reset existing work. Read AGENTS.md, the interview guide, `normalization-and-agents.md` and `sessions.md`.

## Latest user instruction — overrides the earlier provider plan

The user explicitly rejected an OpenAI key and requires the system to be entirely cost-free. **Do not ask for model keys, add a paid API, or reintroduce an LLM dependency.** Removed the OpenAI integration and made reports/fundamentals/DCF fixed, rule-based research workers. Call them that in the CV/interview; do not claim autonomous LLM agents.

Original goals remain: a simple website for equity research, US SEC first, 3–7 annual periods default five, private financial inputs, ratios, charts and defensible DCF, plus interview notes. During this session the user asked what prerequisites were needed and authorized continued building; implemented portable save/reopen while external SEC access remains blocked.

## Implemented v0.4.0

- React/TypeScript/Vite website, Recharts, Zod, Papa Parse, small built-in Node HTTP server. No database, model SDK, new dependency, account system or hosted deployment.
- Shared financial engine (`src/lib/finance.ts`) retains calculation version0.1.0: twelve ratios, CAGR, FCFF, five-year DCF with explicit year-six drivers, EV/equity bridge, scenario/sensitivity and financial guards.
- `src/lib/research.ts` now owns all three deterministic workers. Sample/private research runs locally; public research executes after server source verification. Every evidence item is rendered; run ID/time, input hash, workflow version and traces are exported. Identical inputs give identical evidence. No model name/prompt version/token usage exists in the new contract.
- Deleted `server/agent-provider.ts` and the old `server/agents.ts`; removed key reads, AI checkbox, model configuration, provider tests and model-call rate limits. Strict API rejects old `useAI` options. New prebuild clears only generated `dist-server` so deleted provider code cannot linger in output.
- `server/research-service.ts` validates public references/sample requests. Private uploads still cannot enter that API; private research uses the shared browser workflow. Existing same-origin checks,200KB request cap and one active server request remain. No authentication: personal workspace, not shared public deployment.
- SEC client/service retains genuine contact, proxy-aware HTTPS, rate limits/cache/cooldown, ticker/CIK identity, 10-K/10-K-A reports, archives, source hashes and raw-facts downloads.
- SEC normalization retains exact supported US-GAAP tags, USD/million values, annual periods/restatements/candidates, conflicts and missing data, review gates and source links. Debt, operating NWC and common equity deliberately require manual mapping. No custom tags, PDF parsing or verified current shares. Generic DCF excludes financial SICs and unresolved material inputs.
- `src/lib/session.ts` and `SessionDialog.tsx`: Save session downloads a versioned `.equity.json` file; Open session validates and previews before replacing the workspace. Max5MB. Preserve facts, source evidence/manual notes, assumptions, history and scenario. Omit computed valuations, old research runs and approval flags. No database, localStorage, autosave or server upload.
- Private DCF approval resets after reopen. Synthetic data must match the built-in fixture. SEC restore sets `Dataset.restoredAt`; historicals are labelled a saved snapshot, and DCF/research remain blocked until fresh SEC source review. Refreshing the same issuer keeps saved assumptions/scenario for separate review. Reports and session files are distinct formats; old report JSON is not imported.
- `.equity.json` files are ignored by Git. Financial content stays local. App version0.4.0; session schema1; workflow deterministic-research-1; formula version unchanged.

## Verification

- **64 unit/API tests passed across eight suites.** Coverage includes formulas, CSV, SEC client/discovery/HTTP, normalization, deterministic workers and session validation/recalculation. Obsolete provider tests were removed with the deleted feature; none were skipped to hide a failure.
- **14 Chromium browser tests passed.** Existing analysis flows plus local private research (no POST), source review, report export, stale-run invalidation, save/reload/open, private reapproval, invalid files, SEC snapshot refresh with retained assumptions, mobile and accessibility.
- Production frontend/server build passed. Formatting check is maintained; changed test title formatted. No model endpoint/key/provider reference remains in runtime source or rebuilt dist/dist-server.
- Production runtime check on temporary port3002 exercises local save/reopen, three local workers and the HTTP research endpoint using the synthetic sample. Screenshots: `/workspace/scratch/session-restore-v04.png` and `free-research-v04.png`. No live company data is substituted into this evidence.
- Previously observed/fixed integration issues are recorded in the interview guide: stale API process, Vite Host rewrite, old flex CSS on agent cards. New session validation passed the first test run. Final validation now concerns the cost-free implementation, not the superseded model feature.

## External prerequisites and configuration truth

- SEC contact remains in ignored `.env` (mode600) and cloud variable suggestion. Do not print its value or move it into tracked files/browser variables. No SEC API token is required.
- The fresh `npm run check:sec` attempt on7 November still failed through the environment route. Earlier proxy CONNECT attempts returned403. No real issuer facts or original annual statements have yet been reconciled. User needs to apply working access to `www.sec.gov` and `data.sec.gov`; continue through the supported proxy, never bypass restrictions.
- **No model key is needed or wanted.** A stale `RESEARCH_LLM_API_KEY` secret requirement and `RESEARCH_LLM_MODEL` variable remain in the cloud editor from the older design. The config tool explicitly supports adding but not removing secret requirements; attempting to restrict hosts to SEC caused it to auto-readd `api.openai.com`. Reported this accurately to the user. Delete obsolete fields/domain through the environment editor; do not supply values. The app neither reads them nor calls OpenAI. This cleanup does not block local app work.
- Saved startup instructions now describe the cost-free v0.4 workflow and explicitly prohibit asking for model keys. Existing install script remains npm ci/test/build. Draft saves do not apply settings or publish. No environment publication, paid service, Git push, PR or public deployment was performed.

## Interview log and document target

Local guide: `docs/architecture-and-interview-guide.md`. Updated finance/workflow details, roadmap and session contract. Word snapshot regenerated at `/workspace/scratch/Equity Researcher Interview Guide.docx` with `/workspace/scratch/export_equity_guide.py`; it contains the guide and milestones.

Existing Google Doc authorized by the user:
https://docs.google.com/document/d/1XddU-aStddpJXEN8bic82Q4WKX7ffvCCwC-P3URk0_Q/edit

No Google Drive/Docs editing tools are exposed. Online updates remain pending. Reuse this document, read before updating and preserve user notes; do not create a duplicate. Word export is only a snapshot.

## Next useful work

1. When SEC network settings change, verify genuine-contact configuration without printing values, restart if needed, rerun `npm run check:sec` and reconcile real financial inputs against original statements.
2. Continue improvements within the no-paid-API constraint: reviewed Excel/native-text PDF input, custom-tag review or a clearer research report, as chosen with the user. Do not claim these are implemented.
3. Use the existing Google Doc when tools become available. No model integration is on the plan.

## Startup and process notes

Node22.19+; tested24.19. `npm run dev` starts watched API3001 and Vite5173. `npm run build` clears generated server artifacts then builds client/server. `npm start` serves both from one process; HOST/PORT configurable. `npm run preview` is frontend-only. Tests: npm test; npm run test:e2e; npm run format:check. Chromium `/usr/bin/chromium` when available.

Inspect actual processes/version before reuse. Node may appear as MainThread, not node; long-running tool session IDs can disappear while processes remain. Stop only verified project processes. Runtime processes are not guaranteed to survive restoration. All repository implementation changes remain uncommitted; preserve them.

## Final runtime result

Production v0.4 on temporary port3002 successfully saved/reopened a session, rendered all three local workers and served a synthetic HTTP research request (200). Browser errors:0; external browser requests:0. Both final screenshots were visually inspected. Formatting and Markdown reference checks passed. Stopped only the temporary production process; watched development API3001/Vite5173 remains available and reports secConfigured=true, researchMode=deterministic, paidServicesRequired=false. Final startup draft saved; publication/user-side obsolete-field cleanup remains unperformed.

## Settings assistance — 9 November 2026

User asked how to open environment settings and whether the assistant can perform all setup. Read the current draft: SEC hosts and startup instructions are already saved; obsolete RESEARCH_LLM_API_KEY requirement still exists. Fresh direct SecClient request with genuine configured contact failed with SEC_NETWORK_ERROR. Tools expose draft editing but no apply/publish or secret deletion. Requested opening https://chatgpt.com/codex/settings/environments using open_in_codex; result was queued, not a verified visible settings page. No configuration was reapplied, no key was requested, and no publication occurred. Need user-visible editor navigation or a screenshot if the standard settings link differs in their client.


## Latest resume checkpoint — 9 November 2026: published environment verified

This entry supersedes earlier current-status claims that SEC access and obsolete-setting cleanup remain blocked. The user published the environment and removed obsolete model requirements. Configuration read confirms only www.sec.gov and data.sec.gov, no secret requirements, and SEC_USER_AGENT. Genuine-contact presence was checked without exposing its value. Live SEC requests now work through the supported proxy; TLS remains enabled.

- Existing checkout and all uncommitted work preserved. No application source, tests, dependency or lockfile changes in this verification session. Documentation and scratch validation artifacts updated.
- Started `npm run dev` after restoration (tool session53951, API3001/Vite5173). Processes may need restarting in future tasks; inspect before reuse. Health still reports `liveAccess:not-verified` because it is only a configuration check, not a live network probe.
- `npm run check:sec` passed for Microsoft CIK0000789019. Five annual periods FY2022–FY2026, 578 Company Facts concepts, raw download issuer/fingerprint verified. Normalization returned five July–June periods, no annual-history blockers, 60 populated inputs and30 missing inputs.
- Downloaded official2026/2024/2022 original10-K HTML using genuine contact and proxy. All60 populated values matched original consolidated income, balance-sheet and cash-flow tables, including comparative columns. See docs/live-sec-validation.md for exact source URLs, fingerprints, figures and boundaries. No universal issuer validation is claimed.
- Real Chromium workflow (no request mocks): five filing links, financial-history review, FY2026 expanded, D&A blank, acceptance disabled until review, zero page errors. Artifacts: /workspace/scratch/sec-live/browser-review.png and browser-result.json. Did not check the common-shareholder/lease-scope checkbox or approve Microsoft DCF.
- Six unresolved fields per year: netIncome, depreciation, operatingNwc, debt, equity, interestExpense. Microsoft's combined “Depreciation, amortization, and other” is broader than D&A and its comparative FY2024 value changes between original filings. Missing mappings remain null. Do not broaden tags without source-scope evidence.
- Fresh validation after publication:64 unit/API tests across8 suites passed;14 Chromium browser tests passed; production client/server build passed. Automated SEC suites remain synthetic; the separately documented live checks establish real retrieval and selected-field agreement.
- Updated README, SEC/mapping docs, roadmap, interview guide and this checkpoint. Word snapshot regenerated and reopened successfully at /workspace/scratch/Equity Researcher Interview Guide.docx (221 paragraphs,3 tables). Google Drive/Docs tools still unavailable; existing authorized online document was not read or changed. No background sync exists.
- Updated only saved start_skill to reflect verified access and completed cleanup. Save succeeded; this additional instruction change is a draft, not another publication. Existing install instructions remain npm ci/test/build. Current runtime works; no additional key or network edit is needed. No public website deployment, Git push or PR performed.

### Continue from here

Do not repeat completed setup or rebuild from scratch. User wants the website completed with free deterministic workers and interview-defensible finance. Next useful application improvement: separate historical mapping acceptance from valuation-scope approval (currently FinancialReview ties both to one checkbox), allowing valid historical ratios while unresolved material leases block DCF. Then improve explicit manual-mapping assistance for the six missing inputs without silently treating broad tags as equivalent or missing values as zero. Read architecture guide, normalization-and-agents and sessions before implementing. This improvement is proposed, not implemented here. Preserve3–7years, local private-data boundaries, source hashes and public capitalization limits. No LLM dependency or model key.

## Latest resume checkpoint — 10 November 2026 (Asia/Calcutta): v0.5 release hardening completed

Supersedes the previous “Continue from here” proposal: historical review/DCF separation and manual mapping assistance are now implemented. User authorized finishing the work with repeated tests and strong financial validation. Later “can you try now” was treated as a retry of Google Docs access; discovery still exposes no Drive/Docs reading/writing tools. No online document was changed. Keep the existing authorized document ID; do not create a duplicate.

### Implemented and preserved

- Website/server package v0.5.0, calculation version 0.2.0, workflow deterministic-research-2. No dependencies, paid APIs or model keys added. Existing checkout and all uncommitted work preserved; no Git push/PR or deployment.
- `src/lib/review.ts`: shared Zod review and pure applySourceReview used by FinancialReview and server normalization wrapper. Historical acceptance is independent of `valuationConfirmed` and `valuationNotes`. Legacy reviews default to no suitability approval. Manual overrides require valid signs, finite bounded numbers and notes; sourced values cannot be overwritten. Re-review can edit or clear manual entries; clearing restores missing/conflict and null.
- `src/lib/statement-checks.ts`: checks current versus consolidated totals and cash/investments/receivables versus current assets. No-preferred/no-NCI suitability also checks common-equity balance-sheet reconciliation. CSV, review, normalization and sessions use these checks where scope permits. Existing stricter cash tests remain. Tolerances documented in financial-validation.md.
- `valuationReadiness` in finance.ts shares source/snapshot/sector/suitability/baseline checks across App and runResearch. Latest revenue, EBIT, D&A, CapEx, operatingNwc and debt must be available. Public/private per-share outputs stay withheld. Historical research remains usable while DCF reports a blocker.
- Review mappings button in Sources/Valuation reopens FinancialReview. All accepted changes reset DCF approval and research output; source-derived assumption seeds update while custom assumptions remain for separate review. Scope approval resets on re-review.
- Non-demo DCF now needs `assumptionNotes` plus explicit approval. Notes are included in export, input hash, server request, local/session workflow. Session format remains1; accepts calc0.1.0/0.2.0 and recomputes under0.2.0. Source snapshots still require refresh; legacy missing notes do not imply approval.
- Finance audit: average returns require adjoining dates and matching units; CAGR rejects invalid intervals; ratios/DCF reject nonfinite arithmetic, including intermediate forecast and per-share overflow. Terminal negative reinvestment rejected even at zero growth; terminal ROIC undefined at zero growth. Positive excess cash needs a reported cash balance. Negative residual equity is labelled a shortfall. Charts share the ratio engine. Valuation explicitly dated at the latest fiscal year-end, not current market date.
- Added tests/unit/finance-audit.test.ts (12 substantive tests, including a nine-case parameter grid) and tests/browser/financial-review.spec.ts. Updated existing browser interactions for separate review checks and rationale. Full statement HTML parsing is still a scratch validation activity, not an application feature.

### Actual verification

- 76 unit/API tests across 9 suites passed in normal order and shuffled order (seed 1704). Earlier 64-test baseline passed while implementing. Independent worked answers cover all 12 ratios, flat/growing perpetuities, two-stage FCFF, negative NWC, unit scaling and discount/investment sensitivities.
- 15 Chromium tests repeated twice: 30 passed. The first new browser test failed because its locator said “Debt” instead of the actual “Interest-bearing debt” label. Inspected the failure snapshot, corrected the locator, and passed targeted and repeated complete runs. No skipped/disabled assertions.
- Production frontend/server build passed. Final formatter check rerun after the user returned because the earlier tool session handle disappeared; do not infer a test failure from that stale handle. Local Markdown links/fences are checked before handoff.
- Live SEC retrieval/mapping: Microsoft 3/5/7 years (FY2020–FY2026 maximum) and Apple 3 years(FY2024–FY2026), no annual-history blockers. All 60 earlier Microsoft statement comparisons remain equal. Added 36 Apple comparisons against original2024/2026 10-K consolidated statements; all equal. Total 96 independently checked populated inputs across two issuers. No claim of universal financial-tag correctness.
- Started compiled production server on port3002 and exercised real Chromium MSFT lookup → historical-only review → actual research API → all three workers → report export. FY2026 operating margin matched155237/331839; DCF correctly withheld. Browser errors 0, no mocks. Screenshot inspected. Files under /workspace/scratch/release-v05 include histories, Apple HTML/table extracts/fingerprints,36 comparisons, production check JSON/report and screenshots. Earlier Microsoft artifacts remain in /workspace/scratch/sec-live.

### Documentation and limits

Updated README with demo steps, architecture/interview guide, mapping/session/CSV docs, roadmap and docs/financial-validation.md. Word snapshot regenerated/reopened at /workspace/scratch/Equity Researcher Interview Guide.docx (270 paragraphs,3 tables), now includes the financial audit. The original online Google Doc remains pending tool access; retry on a future capability change, not by inventing a successful sync.

First-release review/hardening scope is complete. Real companies still require manual reconciliation for missing tags and suitability; no actual MSFT/AAPL DCF was approved. CSV-only private inputs, USD millions, no Excel/PDF/OCR, market-price feeds, verified capitalization, qualitative thesis, sector-specific model or public hosting. Tests do not guarantee zero bugs. Preserve these limits when preparing CV claims.

### Process/resume notes

Development normally runs API3001/Vite5173; temporary compiled production validation used3002. Tool sessions/processes can disappear across restoration. Inspect actual commands/ports and use npm run dev if needed; never print identifying contact values. Read this checkpoint and financial-validation.md before further work. All repository source remains uncommitted as before; do not reset or overwrite it.

## Online deployment preparation — 10 November 2026

User asked to put the system online. Prepared render.yaml and docs/deployment.md for one Render Node web service with explicit Free plan, Node24.19.0, HOST=0.0.0.0, injected PORT, server-only SEC_USER_AGENT, health path /api/health and auto-deployment disabled. No finance/runtime source changes or paid resources added. README and interview guide describe hosting as prepared, not live.

No hosting tools/credentials are exposed. Render documentation and GitHub API requests returned proxy403; native Git remote reads work through existing authentication. No token was requested and no restriction was bypassed. The final hosting-account login and service creation require the user; actual Render availability/terms and outbound SEC access remain unverified.

Created branch deploy/free-hosting from the existing work branch; did not alter remote main. Included the previously uncommitted application as necessary for deploying the actual v0.5 code. Checked75 publishable files: no configured contact value, local .env or private session file included. Git upload outcome will be recorded next.

Deployment-equivalent validation used /workspace/scratch/render-validation with no copied .env/node_modules: fresh locked install, production build, prune dev dependencies, HOST=0.0.0.0/PORT3004/NODE_ENV=production start. Initial install command was accidentally issued from the scratch parent (no lockfile) and failed before installation; corrected the working directory and used the existing permitted npm cache. The clean install/build/prune succeeded. Production HTTP research returned200 with3 workers, real Chromium sample research rendered with0 page errors, and /.env,/package.json,/src/App.tsx returned404. This establishes local production readiness, not a completed Render deployment. Existing developer dependencies were preserved in the main checkout.

Git upload succeeded: committed the prepared v0.5 application/deployment as7d945c8 and pushed branch deploy/free-hosting to the existing GitHub repository through native Git authentication. Remote branch SHA independently matched local HEAD. Main was left unchanged. No pull request was created (GitHub API is unavailable); the remote's PR suggestion is not a created PR. The user can select the deployment branch directly in Render. The site itself is not hosted yet; account login/service creation and actual hosted SEC verification remain outstanding. Requested opening the Render dashboard in the Codex browser panel; opening/queuing a tab is not a signed-in account or a deployment.

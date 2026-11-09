# Annual mapping and three agents

Updated: 9 November 2026 (Asia/Calcutta). Implementation v0.5.0. The user requires no paid APIs or model keys. Research is now entirely deterministic. Offline SEC tests use synthetic fixtures; live Microsoft retrieval and 60 original-statement comparisons passed on 9 November. See [live validation](live-sec-validation.md).

## Website workflow

1. **SEC filings** finds a ticker/CIK and 3–7 annual periods, default five. Filing discovery remains separate from accepted financials.
2. **Review financial history** maps supported facts. Expand each fiscal period to inspect tags, values, filing dates and accession links. A source fingerprint, retrieval date and mapping version accompany the dataset.
3. Review the original statements. Missing inputs can remain unavailable or receive a manual number and a specific statement reference/definition. Confirm historical periods, units and accepted definitions, and write a review note before loading. DCF suitability is a separate optional checkbox with an accounting-scope note; leaving it unchecked permits historical analysis while blocking valuation. Material annual-history errors cannot be overridden with the checkbox.
4. Financial ratios use the existing calculation engine. DCF requires complete latest revenue/EBIT/D&A/CapEx/operating-NWC/debt inputs, suitability review and a written forecast-assumption rationale. Reopen **Review mappings** on Sources or Valuation to edit or clear manual values. Shared browser/server review and valuation checks prevent bypasses. Public capitalization is unverified, so public per-share values are withheld.
5. **Research agents** opens the source screen. **Run research** executes all three rule-based workers without a model. All returned evidence is displayed. Export report includes the run, evidence, source review, assumptions and audit trail.

Private CSV files and their research runs stay in the browser. Server requests accept only the built-in sample or a public SEC identifier plus review metadata. Save/Open session preserves work in local files; no automatic persistence, database or server upload is added. See [sessions](sessions.md).

## Mapping policy and financial rationale

- Exact, documented US-GAAP concepts only; no fuzzy custom-tag matching. USD facts are divided by one million. Original values and normalized values are retained; zero remains zero.
- Annual duration facts must end on the selected report date and span 350–380 inclusive days. This supports ordinary calendar and 52/53-week years, while excluding quarters and shortened transition periods. Revenue anchors the start date; other durations must match it. Balance-sheet facts must be instants at the exact period end.
- Labels use the calendar year of the fiscal **end date**, not the SEC `fy` attribute. A comparative 2023 fact in a 2025 filing belongs to 2023. Consecutive years must have adjoining dates. At least three comparable periods are required; there is no padded history.
- Select the latest filed 10-K/10-K-A fact for each period/field. Preserve earlier candidates. Conflicting values or duration contexts on the latest date leave the field unavailable; do not silently fall back to an older number. This is current-information research, not a historical backtest. Later restated comparatives may change historical metrics.
- Common earnings use `NetIncomeLossAvailableToCommonStockholdersBasic`; broad consolidated net income is not silently substituted. Common equity is manually mapped because preferred/NCI scope cannot be inferred reliably from a generic total.
- Operating NWC requires operating components and excludes cash, investments and financing debt. Total debt must cover relevant current/non-current borrowing without duplicate tags and with consistent lease treatment. Both need explicit manual mapping in this first adapter. Missing interest, D&A or CapEx stays unavailable; manual scope review is still necessary even when tags match.
- Negative expenses/assets are flagged, while signed earnings, cash from operations, common equity and operating NWC are allowed where meaningful. Cash cannot exceed current assets. When consolidated assets, liabilities and total equity including NCI are available, the balance sheet must reconcile within the greater of USD 1 or 0.1% of assets. Cash-flow reconciliation is not implemented.
- The first selected period has no automatically fetched opening balance; its ROE/ROA is unavailable unless supporting history exists. Later return ratios use consecutive-year average balances. A source-review checkbox does not turn missing inputs into valid values.
- SIC 6000–6799 issuers are excluded from generic DCF. Industry classification is an initial screen, not proof that all other companies suit this model. Material lease issues, loss-making turnarounds and inconsistent asset scope still require analyst judgment.

## Agent architecture: three deterministic workers

The user rejected paid model APIs on 7 November. Removed the OpenAI adapter, model-key reads, AI checkbox, prompts, token budgets and provider retry/fallback code. The three roles now live in `src/lib/research.ts`, alongside the shared financial engine. They run in a fixed order and expose all returned evidence, not model-selected highlights.

| Role | Fixed tool | Responsibility |
| --- | --- | --- |
| Reports | `inspect_reports` | Summarize company, selected periods, source coverage, missing mappings and annual filings. Deterministic SEC retrieval/source review precedes this step for public companies. |
| Fundamentals | `calculate_ratios` | Compute all twelve financial metrics, formulas, input references and missing-input reasons. |
| DCF | `calculate_dcf` | Compute bear/base/bull values and terminal concentration or explain a valuation blocker. Never change user assumptions. |

The website retains the term **rule-based research agents** for the requested roles. In an interview describe them as modular automated workers, not autonomous LLM agents. They do not understand arbitrary documents, conduct model-driven debate or generate qualitative investment theses. The architecture is useful without those claims: fixed responsibilities, testable outputs and reproducible financial arithmetic.

Sample and private research execute in the browser without network requests. Public research refetches SEC sources on the Node server, checks the source fingerprint and reapplies review entries before running the same functions. Private financials remain excluded from the server API. The only external data dependency is free SEC access; an identifying contact header is required, not an API key.

A run includes ID/time, input SHA-256, calculation version, workflow version, evidence IDs and tool traces. No model name, prompt version or token usage exists in the new contract. Identical inputs produce identical evidence and input hashes; run IDs/times differ. Changed data, history, assumptions or approval invalidate an earlier displayed run. All scenarios are included.

## API and configuration

- `GET /api/sec/normalized?identifier=CIK&years=5&sha256=…`: candidate mapping, evidence and blockers.
- `POST /api/research`: `source`, `historyYears`, `assumptions`, `approved`. No AI toggle or arbitrary uploaded dataset. Old `useAI` options are rejected by the strict schema.
- Same-origin browser checks, a 200 KB body limit and one active server run remain. Model-call rate limits were removed because there are no model calls.
- `/api/health` reports SEC configuration, `researchMode: deterministic`, and `paidServicesRequired: false`. It does not claim successful external retrieval.
- Only `SEC_USER_AGENT` is needed. The website does not read any model credential or access a model endpoint, even if an old environment variable exists.
- `npm run dev` watches server imports. Vite preserves Host for same-origin API requests. Restart after `.env` changes; `npm start` serves the compiled app.

Local use needs no paid service; no hosted deployment is included. A free hosting choice would be a separate deployment decision. Working network access to the SEC hosts remains necessary for public lookup.

## Evaluation and outstanding work

Tests cover financial arithmetic, period/scaling/revision mapping, evidence links, manual review, sector guards, deterministic worker output, source-change rejection, private-data boundaries and session restore. Browser checks include public fixture review, local research, saved-input recalculation, source refresh gates, export consistency, mobile layout and accessibility.

The SEC check passed on 9 November after publication. Five Microsoft annual periods were retrieved and 60 populated inputs matched original statements. Six fields per year and valuation scope remain unresolved. No model key or live-model evaluation is needed. Excel/PDF parsing, custom tags, verified capitalization and qualitative research remain later work.

The user removed the obsolete model requirement, variable and domain and published the environment on 9 November. The current configuration contains only SEC destinations and the contact requirement. No further model cleanup is pending.

See [v0.5 financial validation](financial-validation.md) for 76 unit/API tests,30 successful repeated browser runs,96 original-statement comparisons and the production live-research result.

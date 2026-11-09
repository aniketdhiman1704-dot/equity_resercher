# Equity Researcher

A small, explainable equity research **website** built with React and TypeScript. Explore annual financial history, inspect ratio formulas, and build a five-year DCF with visible assumptions.

## Put it online

A free-hosting configuration is prepared in `render.yaml`: one Node web service serves the website and SEC API together. See [deployment steps](docs/deployment.md). The hosting service has not yet been created; a development-environment publication is separate from a public website deployment.

## Run locally

Use Node **22.19 or newer** (tested with Node 24.19) and npm.

```sh
npm ci
npm run dev
```

`npm run dev` starts the Node API on port **3001** and Vite on port **5173**, with same-origin API proxying. Start with the clearly labelled **Northstar Systems synthetic sample**, or choose **Import financials** and download the CSV template. Private inputs stay in the browser tab. The app requires no paid API or model key. Sample and private research run entirely in the browser. The **SEC filings** lookup and mapping review need an identifying server contact and SEC network access; see [SEC integration](docs/sec-integration.md).

```sh
npm test             # Financial, mapping, SEC, agent and API tests
npm run build        # TypeScript check, website dist/, and server dist-server/
npm run test:e2e     # Chromium browser workflows and accessibility check
npm run format:check
```

Browser tests use `/usr/bin/chromium` when available. On other machines, run `npx playwright install chromium` once. Tests start the development server if it is not already running. Use `npm start` after building to serve the complete website and API from one process on port 3001. `npm run preview` only previews frontend assets on port 4173 and does not provide the SEC API.

## What works

- SEC filing discovery: ticker/CIK lookup, 3–7 annual periods, amendments, source links and fingerprinted raw facts. **Live Microsoft/Apple retrieval and 96 original-statement comparisons passed on 9 November.** See [validation scope and remaining inputs](docs/live-sec-validation.md).

- Annual SEC normalization with retained source candidates, editable manual mappings and separate historical/DCF scope reviews; see [mapping and agents](docs/normalization-and-agents.md).
- Three rule-based research workers (reports, fundamentals, DCF), with deterministic results, source references, audit trails and input hashes. No LLM or paid API.
- **Save session / Open session** downloads and reopens validated `.equity.json` files with financial inputs, assumptions, history and scenario. No database or server upload.
- Responsive overview, financial statements, valuation, and source-inspection screens.
- Three to seven historical years; five by default; supporting opening balances for return ratios.
- Revenue growth, margins, liquidity, leverage, ROE, ROA, cash conversion, and cash flow after CapEx.
- Five-year FCFF/WACC DCF with editable operating assumptions, explicit year-six terminal drivers, equity bridge, bear/base/bull scenarios, and a sensitivity table.
- Reviewed CSV imports with period/unit/numeric checks, missing-value handling, and balance-sheet checks. See the [template contract](docs/csv-template.md).
- Ratio evidence dialogs, source file fingerprints, financial CSV export, and JSON research reports containing the inputs and results.

## Current limits

**Live SEC retrieval is verified for Microsoft and Apple.** Missing inputs still require manual accounting review; retrieved statements do not automatically approve an issuer valuation. No SEC API key is required. The OpenAI integration was removed at the user's request: no model setup, API credits or paid data service is needed. These are deterministic workers, not autonomous language-model agents. Public-market scope is US non-financial operating companies.

Private CSV imports support USD millions and completed January–December fiscal years. SEC mapping supports comparable full fiscal years, including 52/53-week years, with source review. Excel/PDF extraction, flexible mapping, and ROIC normalization come later. Banks, insurers, loss-making turnarounds, and material unresolved financing leases need separate methods. Non-sample per-share values are withheld until capitalization is verified.

**Save session before refreshing** to keep inputs, assumptions and scenario in a local file. Open session validates and restores that file; results are recalculated and private DCF assumptions need approval again. Saved SEC snapshots require fresh source review before valuation or agent runs. Research-report JSON and session files are distinct formats. There is no automatic save. No user accounts, persistent research storage, or cloud deployment are included in this release. The SEC server has a bounded in-memory public-data cache, not a database.


## Demonstrate the finished first release

1. Use the synthetic sample to walk through ratios, five-year DCF, scenarios, sensitivity and report export.
2. Use **SEC filings** to retrieve a real company and review its historical mappings. Unavailable facts stay blank; original statements remain the authority.
3. Use **Review mappings** to add documented manual inputs. Confirm DCF suitability separately, then explain and apply the forecast assumptions. Real per-share values remain withheld until capitalization is verified.
4. Use **Research agents** for all three workers, **Export report** for results and **Save session** to resume later.

The [financial validation log](docs/financial-validation.md) records independent formula examples, repeated tests, 96 real statement comparisons and remaining limits.

## Architecture and interview notes

`src/lib/finance.ts` contains the pure calculation functions; React only manages inputs and presentation. Zod validates imported rows, Papa Parse reads CSV, and Recharts draws the charts. A small Node/TypeScript server owns SEC requests, configured contact identity, proxy handling, caching, and rate limits. The shared `src/lib/research.ts` workflow runs the three fixed roles in the browser for sample/private data and on the server for public data. Financial formulas remain shared and deterministic.

- [v0.5 financial audit, repeated tests and release limits](docs/financial-validation.md)
- [Architecture, finance, decisions, and interview guide](docs/architecture-and-interview-guide.md)
- [SEC setup, API, tests, and live validation](docs/sec-integration.md)
- [Portable research sessions](docs/sessions.md)
- [Implementation milestones](docs/implementation-plan.md)
- [Development checkpoint and next steps](docs/WORKLOG.md)
- [User-provided Google interview log](https://docs.google.com/document/d/1XddU-aStddpJXEN8bic82Q4WKX7ffvCCwC-P3URk0_Q/edit) — online updates are pending connector access; the local guide is current.

This is a research and learning tool. Synthetic examples are not recommendations or representations of real securities.

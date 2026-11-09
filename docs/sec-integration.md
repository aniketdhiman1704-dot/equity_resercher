# SEC filing discovery — step 1

Updated: 9 November 2026 (Asia/Calcutta).

## What is implemented

The website's **SEC filings** button calls a small Node/TypeScript server. Enter a ticker (MSFT is the representative first target) or a numeric CIK and request 3–7 annual filing periods, default five.

The server resolves identity through the SEC ticker directory, reads recent submissions, follows archived submission pages when needed, and lists original 10-K reports with 10-K/A amendments separately. It also retrieves the issuer's unmodified Company Facts JSON. The response includes official source URLs, retrieval times, and SHA-256 fingerprints. Downloads are checked against the fingerprint shown by the lookup so a later upstream update cannot silently replace that source version.

**The discovery response remains separate from accepted financial analysis.** `analysisReady` is always false for discovery. Step 2 is now implemented: **Review financial history** requests an annual mapping, exposes source candidates and missing inputs, and requires user review before loading. See [annual mapping and agents](normalization-and-agents.md). Selected-field live reconciliation passed for Microsoft; see [evidence and limits](live-sec-validation.md).

Only 10-K and 10-K/A reports are supported in this step. Annual period ends can differ from December 31; that does not imply that the private CSV importer or financial model now supports every fiscal calendar. Original filing HTML is linked on SEC, not downloaded, executed, or parsed by this server. A filing-index link is included for source inspection.

## Configuration and startup

Use Node **22.19+**, tested with Node 24.19. The proxy-aware HTTP library requires this minimum. There is no SEC API key.

Configure the server variable **`SEC_USER_AGENT`** with an application name followed by your genuine contact email. The `.env.example` file intentionally leaves it empty. For local development, copy the example to the ignored `.env` and supply your own contact. In the cloud, enter the value in environment settings. Never put it in a `VITE_` variable or a committed file. The application neither invents a contact nor presents placeholder addresses as configured.

Allow these HTTPS destinations:

- `www.sec.gov` — ticker directory, report/index links, developer guidance.
- `data.sec.gov` — submissions, archived submission metadata, and Company Facts.

`npm run dev` starts the API on loopback port 3001 and Vite on port 5173. Vite proxies `/api` to the API, keeping browser requests on the same origin. `npm run dev:api` and `npm run dev:web` are available for focused development. Restart the API after changing the server environment.

`npm run build` compiles the website into `dist/` and the server into `dist-server/`. `npm start` serves both from one process on loopback port 3001 by default; deployments can supply `HOST` and `PORT`. There is no public deployment yet. `npm run preview` only previews static frontend assets and does not start or proxy the API; use the production server to validate the complete application.

## Minimal API

| Route | Result |
| --- | --- |
| `GET /api/health` | Process/configuration status; never returns the identifying contact and does not prove live SEC access. |
| `GET /api/sec/company?identifier=MSFT&years=5` | Identity, annual filing links, amendments, raw-fact metadata, coverage warnings, and source references. |
| `GET /api/sec/facts?cik=0000789019&sha256=…` | Original Company Facts JSON as a download. A changed fingerprint returns 409 and requires a fresh lookup. |

This server accepts no private-file uploads. The new `POST /api/research` route accepts reviewed public identifiers or the built-in sample and calculation options; it does not persist writes. It does not accept arbitrary upstream URLs. Production static serving is limited to the built website directory. Unknown API routes are explicit 404s.

## Request policy and failure behavior

- One shared SEC client serializes upstream requests with at least 500 ms between their start times (at most two per second per process).
- Duplicate in-flight URLs share a request. Successful JSON responses are cached for 15 minutes; the cache is limited to 40 entries and 64 MB of raw response bytes. Parsed objects have additional overhead. Cache is in memory and disappears on restart.
- A response is limited to 30 MB and each network attempt to 12 seconds. The pending queue is capped at 24 distinct URLs. Archive discovery is capped at 12 pages and warns when that limit is reached.
- 429/503 responses use bounded retries, honor `Retry-After`, and maintain a client-wide cooldown. Long requested pauses are surfaced rather than shortened. A 403 denial is not repeatedly retried, and no alternative host is used to bypass it.
- The HTTP client honors the environment's proxy through `EnvHttpProxyAgent`; TLS verification remains enabled. Redirects are rejected. Browser errors omit proxy internals and contact values.
- Schema, CIK, accession, date, filename, and column-length checks reject ambiguous or inconsistent source records. Amendments alone do not count as original annual reports. Missing history is reported, never padded with zero or sample data.
- Fact schemas are preserved as raw data at this stage. Structural acceptance is not evidence of correct accounting interpretation. Sixty mapped Microsoft inputs have now been checked against original statements; this does not establish universal mapping correctness.

## Validation evidence and blocker

On 2 November 2026, **45 unit/API tests and 8 Chromium browser tests passed**, including request pacing, caching/expiry, retries and cooldown, timeout, domain restrictions, identity checks, archived reports, separate amendments, raw download fingerprints, missing contact, error UI, mobile layout, and accessibility checks. SEC tests use explicitly **synthetic SEC-shaped fixtures**, not live or captured disclosures. The pre-existing ratio/DCF and CSV tests also pass.

The TypeScript frontend/server build passes. The compiled production server was checked for static page rendering and its missing-contact response. These checks establish code behavior, not external connectivity.

On 9 November the user published the environment after removing obsolete model requirements and allowing both SEC hosts. `npm run check:sec` now passes for MSFT: five periods FY2022–FY2026 and matching raw facts. Three original annual HTML reports were retrieved and 60 mapped values matched their consolidated statements. Live Chromium lookup and mapping review passed without mocks or page errors. Six fields per year, lease/accounting scope and current capitalization remain unresolved; no Microsoft DCF was approved. See [live evidence](live-sec-validation.md). Health remains a configuration check, not a live connectivity probe.

## Interview explanation

“I separated retrieving official records from interpreting them. SEC Company Facts is a collection of tagged facts, not a ready-made comparable financial statement. My first adapter establishes company identity, preserves annual-report and raw-data evidence, and handles access limits predictably. Only a validated mapping should feed the financial model.”

## Cost-free runtime

Only SEC network access and the genuine identifying contact are required. The model adapter was removed on 7 November: the research roles are shared deterministic functions and no API key is needed. `/api/health` now reports `researchMode: deterministic` and `paidServicesRequired: false`; these flags do not imply that SEC connectivity is working. See `normalization-and-agents.md` for the obsolete cloud-setting cleanup.

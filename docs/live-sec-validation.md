# Live SEC verification — Microsoft

Verified: 9 November 2026 (Asia/Calcutta). Website v0.4.0; mapping `sec-us-gaap-1`.

## What passed

After the user published the environment, live SEC access succeeded through the supported proxy with TLS verification enabled and the existing genuine contact. The saved configuration contains only the two SEC hosts, no model secret requirement, and the SEC contact variable. No paid API or model was used.

`npm run check:sec` passed: MSFT resolved to CIK 0000789019, five annual periods were returned, and the fingerprinted raw Company Facts download matched the issuer. Annual normalization returned FY2022–FY2026, July–June periods, with no blocking annual-history issues. This does not approve valuation inputs.

A real Chromium browser run, without request mocks, opened SEC filings, retrieved five reports, opened annual mapping, and displayed FY2026. D&A stayed blank and Load reviewed financials stayed disabled pending review. No browser page errors occurred. We did not attest that unresolved lease/accounting scope was reviewed or generate an unsupported Microsoft valuation.

## Original-statement reconciliation

Downloaded the official 2026, 2024 and 2022 annual reports returned by SEC submission metadata. Read their consolidated income statements, balance sheets and cash-flow statements, including comparative columns. Compared all 12 populated fields in each of five normalized years: **60 comparisons, all equal in USD millions**. Fields: revenue, gross profit, operating income, CFO, cash CapEx, assets, liabilities, current assets, current liabilities, cash, short-term investments and net receivables. CapEx is a positive cash outflow in the app; parentheses in the cash-flow statement represent cash used.

| Fiscal year ended June 30 | Revenue | Operating income | CFO | Cash CapEx | Total assets | Original filing used |
| --- | --- | --- | --- | --- | --- | --- |
| 2022 | 198,270 | 83,383 | 89,035 | 23,886 | 364,840 | 2022 |
| 2023 | 211,915 | 88,523 | 87,582 | 28,107 | 411,976 | 2024 |
| 2024 | 245,122 | 109,433 | 118,548 | 44,477 | 512,163 | 2024 |
| 2025 | 281,724 | 128,528 | 136,162 | 64,551 | 619,003 | 2026 |
| 2026 | 331,839 | 155,237 | 182,935 | 115,948 | 758,376 | 2026 |

This is one-issuer, selected-field reconciliation, not validation of every issuer, custom tag, footnote, amendment or valuation assumption. The selected latest-disclosure policy is not point-in-time research. The application itself still links original HTML; this manual validation did not add an HTML/PDF importer.

## Missing inputs and finance lessons

Six fields remain unavailable in each year: common-shareholder net income, pure D&A, operating NWC, debt, common equity and gross interest expense. Missing tags are not zeros. Reported net income, combined noncash adjustments and total stockholders’ equity cannot simply be substituted for the narrower model definitions without checking scope.

Microsoft labels its cash-flow adjustment “Depreciation, amortization, and other.” That is not automatically pure D&A. Its FY2024 comparative value is 20,958 in the 2026 filing versus 22,287 in the 2024 filing; the investments/derivatives adjustment also changes. This illustrates why disclosure versions and definitions matter even when total CFO agrees. No inference about the reason for the reclassification was automated.

Debt and operating NWC require explicit account definitions, and leases require consistent cash-flow and financing treatment. We left the common-shareholder/lease-scope confirmation unchecked. Public per-share values also remain withheld until capitalization is verified. The next development priority is a defensible review workflow that separates usable historical ratios from unresolved valuation scope, then supports documented missing-input mappings. It is not a need for an LLM or paid data source.

## Source fingerprints

Company Facts: https://data.sec.gov/api/xbrl/companyfacts/CIK0000789019.json

Retrieved at `2026-11-09T16:12:01.670Z`; SHA-256 `8c1903c041f5c27e86ed15f37debb1f41882b7904bba129ef9edc76478b1e8ea`. The response contains 578 concepts.

- [2026 original 10-K](https://www.sec.gov/Archives/edgar/data/789019/000119312526323660/msft-20260630.htm): SHA-256 `12b8ee05410579669cd1f1f6b0d53a18425ba084858bef9fe7ec6da30fcad7ce`.
- [2024 original 10-K](https://www.sec.gov/Archives/edgar/data/789019/000095017024087843/msft-20240630.htm): SHA-256 `250095448723f34519b07b43e6600269436da2976a3f0e7fbb92bfaeba9150bd`.
- [2022 original 10-K](https://www.sec.gov/Archives/edgar/data/789019/000156459022026876/msft-10k_20220630.htm): SHA-256 `c23f1e8f7c98417a082b64a3e46c5b1ae462eb1014a787b953953a06c6730204`.

Local validation artifacts are in `/workspace/scratch/sec-live/`: raw facts, normalized mapping, original HTML, extracted statement tables, 60 comparison records and the browser screenshot/result. These are public-source validation artifacts, not private uploads. No contact values are recorded here.

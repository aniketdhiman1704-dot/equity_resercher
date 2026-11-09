# Private-company CSV template

Download the template from **Import financials** in the website. It contains explicitly synthetic example rows; replace them with your company’s values. No document content is sent to a server or AI provider.

## Supported scope

- 3–7 completed, consecutive January–December fiscal years; optionally one extra opening year, for at most eight rows. Only the most recent seven can be displayed. Default display is five years or the available three/four years.
- `currency` must be `USD` and `scale` must be `millions`. Conversion from other currencies/scales is not automatic.
- Plain numeric amounts, with a decimal point if needed. No dollar signs or thousands separators. Blank fields mean unavailable, **not zero**.
- Non-financial operating companies with income and equity attributable to common shareholders. No material unadjusted minority/preferred interests or unresolved financing leases. The review checkbox makes these assumptions explicit.
- Company identity is entered in the review screen. Filenames and company names remain local. No audit assurance is implied.

Retain all template columns; field order may vary. Additional or missing columns are rejected rather than silently ignored. Use CSV quoting for any special CSV syntax. UTF-8 with an optional BOM is supported.

## Fields

| Column | Meaning |
| --- | --- |
| `fiscalYear` | Integer, e.g. 2025. |
| `periodStart` | Exactly `2025-01-01` for that example. |
| `periodEnd` | Exactly `2025-12-31`; must be a completed period. |
| `currency`, `scale` | `USD`, `millions`. |
| `revenue`, `grossProfit`, `ebit` | Annual consolidated revenue, gross profit, and operating EBIT. Reconcile one-offs and operating scope yourself. |
| `netIncome` | Net income attributable to common shareholders. |
| `depreciation` | Annual depreciation **and amortization**, a nonnegative expense/add-back. |
| `capex` | Capital expenditure cash outflow as a **positive** number. Do not copy a negative cash-flow presentation sign without normalizing it. |
| `operatingNwc` | Operating current assets less operating current liabilities, excluding cash/investments and financing debt. Review included accounts; this value may be negative. |
| `cashFromOperations` | Reported annual cash flow from operations; may be negative. CFO less CapEx is not unlevered FCFF. |
| `totalAssets`, `totalLiabilities` | Fiscal year-end balance-sheet totals. |
| `currentAssets`, `currentLiabilities` | Fiscal year-end current balances. |
| `cash`, `shortTermInvestments`, `receivables` | Fiscal year-end liquidity inputs. |
| `debt` | Interest-bearing financing debt, not total liabilities. |
| `equity` | Common equity; may be negative. Nonpositive equity makes conventional ROE/debt-to-equity interpretation unavailable. |
| `interestExpense` | Gross annual interest expense, not net interest income. |

The importer reconciles assets to liabilities plus common equity when all three are provided, allowing the greater of USD 1 million or 0.1% of assets as rounding tolerance. This check is not proof of correct accounting. It also rejects cash exceeding current assets, negative nonnegative-domain fields, duplicate/gapped years, and unsupported annual durations.

## From input to valuation

1. Select the CSV; inspect the parsed periods and missing-field notice.
2. Confirm company identity, mapping, units, and supported accounting scope.
3. Inspect statements and ratios. Each ratio links to `FYyear:field` references; average-balance ratios need a valid preceding year.
4. Open **DCF valuation**. Initial operating ratios use the latest year, and growth is seeded from at most five years. WACC, tax, and terminal growth are proposed teaching inputs and require review. Excess cash and additional capital claims/assets start at zero; verify them explicitly.
5. Document the assumption rationale (growth/margin, tax, reinvestment, WACC, terminal growth and capital claims), then apply reviewed assumptions to generate enterprise and equity values as of the latest fiscal year-end. Changing a base input invalidates that acceptance. Per-share outputs remain unavailable for private imports.
6. Export the JSON report to retain source values, SHA-256 file fingerprint, assumptions, formulas, version, and valuation. Reloading the tab clears the working data; JSON restore is future work.

Excel imports, PDF/OCR extraction, non-calendar years, cash-flow reconciliation, and flexible field mapping are not implemented in this release.

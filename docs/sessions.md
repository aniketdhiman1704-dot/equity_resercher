# Portable research sessions

Updated: 9 November 2026 (Asia/Calcutta).

Use **Save session** to download an `.equity.json` file. **Open session** reads it locally, shows the company/history/scenario, and asks you to confirm replacing the current workspace. Invalid files leave the workspace intact. There is no automatic save, browser localStorage, database or server upload.

Session version 1 stores the dataset, SEC evidence/review where applicable, input assumptions and their rationale, displayed-history length, scenario, saved time and calculation version. It omits computed valuations, agent results and forecast-approval flags. Source/scope review notes remain evidence; they cannot bypass SEC refresh. v0.5 accepts calculation versions 0.1.0 and 0.2.0 and recomputes using 0.2.0. Missing legacy suitability fields default to unapproved, and missing assumption rationale defaults to empty. Reopening recalculates results; it never trusts a stored output as an answer.

- Synthetic sessions must match the built-in sample financials and identity. Edited synthetic data belongs in the reviewed CSV import path.
- Private sessions reuse financial-import validation and retain their original source fingerprint. Missing values remain missing; null saved assumptions return as incomplete inputs. DCF assumptions require approval again, even if previously approved.
- SEC sessions preserve tags, candidates, manual notes and official accession links, with checks on units, dates, evidence/value agreement and safe source URLs. Opening creates a **saved snapshot** status. Historical ratios can be inspected, but DCF and research runs remain blocked until the issuer is refreshed and reviewed against SEC. A structurally valid local file is not proof of a genuine or current disclosure.
- Refreshing the same saved CIK preserves edited assumptions and scenario for separate review; it replaces the historical data with newly reviewed source data. A changed issuer starts a new set of assumptions.
- Files over 5 MB, unsupported versions, unknown fields, inconsistent history and unsafe evidence links are rejected. The serializer checks its own output against the same parser before downloading.

**Export report** still creates a separate research-result JSON file. It is not a session format. Keep a session for resuming work and a report for recording outputs. The first session release deliberately rejects unversioned older report files rather than guessing a migration.

Session files contain financial information and are not encrypted by the app. The user chooses where to store them. `*.equity.json` is ignored by Git. Opening, saving and running research on private data make no server requests. Closing/reloading without saving still loses changes.

Interview explanation: “I chose portable, versioned files before a database because the app is a personal research tool. I validate restored inputs and recompute outputs, so a stale or edited cached valuation cannot silently become the current answer.”

import { z } from 'zod';
import { SecError } from './errors.ts';
import type { SecClient, SecDocument } from './sec-client.ts';
import type { SecAnnualPeriod, SecCompanyReports, SecFiling } from '../src/lib/sec-types.ts';

const TICKERS = 'https://www.sec.gov/files/company_tickers.json';
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const rowTable = z.object({
  accessionNumber: z.array(z.string()),
  form: z.array(z.string()),
  filingDate: z.array(z.string()),
  reportDate: z.array(z.string()),
  primaryDocument: z.array(z.string()),
});
const submissions = z.object({
  cik: z.string().regex(/^\d{1,10}$/),
  name: z.string().min(1),
  tickers: z.array(z.string()).default([]),
  sic: z.string().default(''),
  sicDescription: z.string().default(''),
  filings: z.object({
    recent: rowTable,
    files: z
      .array(
        z.object({
          name: z.string(),
          filingFrom: z.string(),
          filingTo: z.string(),
        }),
      )
      .default([]),
  }),
});
const factsSchema = z
  .object({
    cik: z.number().int().positive(),
    entityName: z.string(),
    facts: z.record(z.string(), z.record(z.string(), z.unknown())),
  })
  .passthrough();

export function normalizeCik(value: string): string {
  const clean = value.trim().replace(/^CIK/i, '');
  if (!/^\d{1,10}$/.test(clean) || Number(clean) === 0)
    throw new SecError(
      'INVALID_IDENTIFIER',
      'Enter a valid ticker or a positive SEC CIK of at most ten digits.',
      400,
    );
  return clean.padStart(10, '0');
}

export function parseHistoryYears(value: string | null): number {
  if (value === null) return 5;
  if (!/^[3-7]$/.test(value))
    throw new SecError('INVALID_HISTORY', 'Choose between 3 and 7 annual filing periods.', 400);
  return Number(value);
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new SecError(
      'SEC_SCHEMA_CHANGED',
      'SEC data did not match the expected structure. No partial or guessed data was used.',
    );
  return result.data;
}

function validDate(value: string): boolean {
  if (!date.safeParse(value).success) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString().startsWith(value);
}

export function filingsFromTable(value: unknown, cik: string): SecFiling[] {
  const table = parse(rowTable, value);
  const size = table.accessionNumber.length;
  if (Object.values(table).some((column) => column.length !== size))
    throw new SecError('SEC_SCHEMA_CHANGED', 'SEC filing columns have inconsistent lengths.');
  const filings: SecFiling[] = [];
  for (let i = 0; i < size; i++) {
    const form = table.form[i];
    if (form !== '10-K' && form !== '10-K/A') continue;
    const accession = table.accessionNumber[i];
    const filed = table.filingDate[i];
    const periodEnd = table.reportDate[i];
    const document = table.primaryDocument[i];
    if (
      !/^\d{10}-\d{2}-\d{6}$/.test(accession) ||
      !validDate(filed) ||
      !validDate(periodEnd) ||
      !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,179}$/.test(document) ||
      filed < periodEnd
    ) {
      throw new SecError(
        'SEC_INVALID_FILING',
        'An annual filing has invalid dates or document identifiers. Review the SEC source.',
      );
    }
    const base = `https://www.sec.gov/Archives/edgar/data/${Number(normalizeCik(cik))}/${accession.replaceAll('-', '')}`;
    filings.push({
      accession,
      form,
      filed,
      periodEnd,
      document,
      documentUrl: `${base}/${encodeURIComponent(document)}`,
      indexUrl: `${base}/${accession}-index.html`,
    });
  }
  return filings;
}

export function groupAnnualFilings(filings: SecFiling[], years: number): SecAnnualPeriod[] {
  const unique = new Map<string, SecFiling>();
  for (const filing of filings) {
    const previous = unique.get(filing.accession);
    if (previous && JSON.stringify(previous) !== JSON.stringify(filing))
      throw new SecError(
        'SEC_CONFLICTING_FILING',
        'The SEC sources disagree about an accession. Resolve the source conflict before analysis.',
      );
    unique.set(filing.accession, filing);
  }
  const periods = new Map<string, SecFiling[]>();
  for (const filing of unique.values())
    periods.set(filing.periodEnd, [...(periods.get(filing.periodEnd) ?? []), filing]);
  return [...periods]
    .sort(([a], [b]) => b.localeCompare(a))
    .flatMap(([periodEnd, items]) => {
      const originals = items
        .filter((f) => f.form === '10-K')
        .sort((a, b) => a.filed.localeCompare(b.filed) || a.accession.localeCompare(b.accession));
      if (!originals.length) return []; // An amendment alone does not establish an annual report.
      if (originals.length > 1)
        throw new SecError(
          'SEC_AMBIGUOUS_PERIOD',
          'Multiple original annual reports share a period end. Review this reporting transition manually.',
        );
      return [
        {
          periodEnd,
          annual: originals[0],
          amendments: items
            .filter((f) => f.form === '10-K/A')
            .sort((a, b) => b.filed.localeCompare(a.filed)),
        },
      ];
    })
    .slice(0, years);
}

export class SecService {
  constructor(private client: Pick<SecClient, 'getJson'>) {}
  async resolveIdentifier(identifier: string): Promise<string> {
    const clean = identifier.trim().toUpperCase();
    if (/^(CIK)?\d+$/.test(clean)) return normalizeCik(clean);
    if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(clean))
      throw new SecError(
        'INVALID_IDENTIFIER',
        'Enter a ticker such as MSFT, or a numeric SEC CIK. Company-name search is not supported yet.',
        400,
      );
    const directory = await this.client.getJson(TICKERS);
    const entries = parse(
      z.record(
        z.string(),
        z.object({ cik_str: z.number().int().positive(), ticker: z.string(), title: z.string() }),
      ),
      directory.data,
    );
    const matches = [
      ...new Set(
        Object.values(entries)
          .filter((e) => e.ticker.toUpperCase() === clean)
          .map((e) => normalizeCik(String(e.cik_str))),
      ),
    ];
    if (!matches.length)
      throw new SecError(
        'COMPANY_NOT_FOUND',
        'That ticker was not found in the SEC directory. Try its numeric CIK.',
        404,
      );
    if (matches.length > 1)
      throw new SecError(
        'AMBIGUOUS_COMPANY',
        'The ticker has multiple SEC identities. Use its numeric CIK.',
        409,
      );
    return matches[0];
  }

  async companyFacts(cik: string): Promise<SecDocument> {
    const normalized = normalizeCik(cik);
    const response = await this.client.getJson(
      `https://data.sec.gov/api/xbrl/companyfacts/CIK${normalized}.json`,
    );
    const facts = parse(factsSchema, response.data);
    if (normalizeCik(String(facts.cik)) !== normalized)
      throw new SecError(
        'SEC_IDENTITY_MISMATCH',
        'SEC financial facts do not match the requested company CIK.',
      );
    return response;
  }

  async companyReports(identifier: string, years: number): Promise<SecCompanyReports> {
    parseHistoryYears(String(years));
    const cik = await this.resolveIdentifier(identifier);
    const recent = await this.client.getJson(`https://data.sec.gov/submissions/CIK${cik}.json`);
    const company = parse(submissions, recent.data);
    if (normalizeCik(company.cik) !== cik)
      throw new SecError(
        'SEC_IDENTITY_MISMATCH',
        'SEC submission metadata does not match the requested CIK.',
      );
    const sources = [recent];
    const filings = filingsFromTable(company.filings.recent, cik);
    let periods = groupAnnualFilings(filings, years);
    const files = [...company.filings.files].sort((a, b) => b.filingTo.localeCompare(a.filingTo));
    let scanned = 0;
    // Fetch archive pages until the oldest page predates the earliest selected annual filing.
    // This also discovers amendments even when recent metadata contains enough original 10-Ks.
    for (const file of files) {
      if (!validDate(file.filingFrom) || !validDate(file.filingTo))
        throw new SecError('SEC_SCHEMA_CHANGED', 'An archived submission date range is invalid.');
      const earliestSelected = periods.length >= years ? periods.at(-1)!.annual.filed : null;
      if (earliestSelected && file.filingTo < earliestSelected) break;
      if (scanned === 12) break;
      if (!new RegExp(`^CIK${cik}-submissions-\\d{3}\\.json$`).test(file.name))
        throw new SecError('SEC_INVALID_ARCHIVE', 'SEC returned an unexpected archive name.');
      const archive = await this.client.getJson(`https://data.sec.gov/submissions/${file.name}`);
      sources.push(archive);
      scanned++;
      filings.push(...filingsFromTable(archive.data, cik));
      periods = groupAnnualFilings(filings, years);
    }
    const rawFacts = await this.companyFacts(cik);
    const facts = parse(factsSchema, rawFacts.data);
    const warnings = [
      'SEC Company Facts are raw reported facts, not normalized financial statements. Tags, periods, units, and restatements must be reconciled before ratios or valuation.',
      'Report links have been assembled from SEC submission metadata. This lookup has not independently checked every figure in the original statements.',
    ];
    if (periods.length < years)
      warnings.push(
        `Found ${periods.length} annual filing periods of ${years} requested. Missing years have not been filled.`,
      );
    if (periods.length < 3)
      warnings.push(
        'Fewer than three annual filing periods: history is insufficient for the full analysis workflow.',
      );
    if (periods.some((p) => p.amendments.length))
      warnings.push(
        'Amendments are listed separately; an amendment does not necessarily restate the financial statements.',
      );
    if (scanned === 12)
      warnings.push('Reached the 12-page archive limit. Older filing coverage may be incomplete.');
    for (let i = 1; i < periods.length; i++) {
      const gap =
        (Date.parse(periods[i - 1].periodEnd) - Date.parse(periods[i].periodEnd)) / 86_400_000;
      if (gap < 330 || gap > 400) {
        warnings.push(
          'Period ends are not approximately annual. A reporting transition or missing year needs review.',
        );
        break;
      }
    }
    const sic = Number(company.sic);
    if ((sic >= 6000 && sic <= 6499) || sic === 6798)
      warnings.push(
        'This issuer may be a financial institution or REIT. The general operating-company DCF is not suitable without a sector-specific model.',
      );
    return {
      company: {
        cik,
        name: company.name,
        tickers: company.tickers,
        sic: company.sic,
        industry: company.sicDescription,
      },
      requestedYears: years,
      periods,
      warnings,
      coverage: periods.length >= years ? 'requested-history-found' : 'partial-history',
      analysisReady: false,
      facts: {
        sourceUrl: rawFacts.url,
        downloadPath: `/api/sec/facts?cik=${cik}&sha256=${rawFacts.sha256}`,
        retrievedAt: rawFacts.retrievedAt,
        sha256: rawFacts.sha256,
        taxonomyCount: Object.keys(facts.facts).length,
        conceptCount: Object.values(facts.facts).reduce(
          (n, concepts) => n + Object.keys(concepts).length,
          0,
        ),
      },
      submissionSources: sources.map((s) => ({
        url: s.url,
        retrievedAt: s.retrievedAt,
        sha256: s.sha256,
      })),
    };
  }
}

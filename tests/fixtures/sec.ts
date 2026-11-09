/** Entirely synthetic SEC-shaped records. Not captured or verified company disclosures. */
export const fixtureContact = 'EquityResearcher unit-tests@equity-research.test';
export const cik = '0000789019';
export const tickerUrl = 'https://www.sec.gov/files/company_tickers.json';
export const submissionsUrl = `https://data.sec.gov/submissions/CIK${cik}.json`;
export const archiveUrl = `https://data.sec.gov/submissions/CIK${cik}-submissions-001.json`;
export const factsUrl = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;

export const filing = (year: number, form = '10-K', suffix = '000001') => ({
  accessionNumber: `0000789019-${String(year).slice(-2)}-${suffix}`,
  form,
  filingDate: `${year}-07-30`,
  reportDate: `${year}-06-30`,
  primaryDocument: `fixture-${year}0630.htm`,
});
export function table(rows: ReturnType<typeof filing>[]) {
  return {
    accessionNumber: rows.map((r) => r.accessionNumber),
    form: rows.map((r) => r.form),
    filingDate: rows.map((r) => r.filingDate),
    reportDate: rows.map((r) => r.reportDate),
    primaryDocument: rows.map((r) => r.primaryDocument),
  };
}
export function fixtureRecords(): Record<string, unknown> {
  return {
    [tickerUrl]: {
      '0': { cik_str: 789019, ticker: 'MSFT', title: 'Fixture Software (synthetic)' },
    },
    [submissionsUrl]: {
      cik,
      name: 'Fixture Software (synthetic)',
      tickers: ['MSFT'],
      sic: '7372',
      sicDescription: 'Software test fixture',
      filings: {
        recent: table([
          filing(2025),
          { ...filing(2025, '10-K/A', '000002'), filingDate: '2025-08-15' },
          filing(2024),
          { ...filing(2025, '10-Q', '000003'), reportDate: '2025-03-31', filingDate: '2025-04-30' },
        ]),
        files: [
          {
            name: `CIK${cik}-submissions-001.json`,
            filingFrom: '2019-01-01',
            filingTo: '2023-12-31',
          },
        ],
      },
    },
    [archiveUrl]: table([2023, 2022, 2021, 2020, 2019].map((year) => filing(year))),
    [factsUrl]: {
      cik: 789019,
      entityName: 'Fixture Software (synthetic)',
      facts: {
        'us-gaap': {
          Revenues: {
            label: 'Synthetic revenue',
            units: {
              USD: [
                {
                  start: '2024-07-01',
                  end: '2025-06-30',
                  val: 123_000_000,
                  accn: '0000789019-25-000001',
                  fy: 2025,
                  fp: 'FY',
                  form: '10-K',
                  filed: '2025-07-30',
                },
              ],
            },
          },
        },
      },
    },
  };
}

export function fixtureTransport(records = fixtureRecords()) {
  return async (url: string) =>
    Object.hasOwn(records, url)
      ? Response.json(records[url])
      : new Response('Not found', { status: 404 });
}

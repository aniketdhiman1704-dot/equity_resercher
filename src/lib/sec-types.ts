/** Filing discovery is separate from normalized financial statements. */
export interface SecFiling {
  accession: string;
  form: '10-K' | '10-K/A';
  filed: string;
  periodEnd: string;
  document: string;
  documentUrl: string;
  indexUrl: string;
}

export interface SecAnnualPeriod {
  periodEnd: string;
  annual: SecFiling;
  amendments: SecFiling[];
}

export interface SecCompanyReports {
  company: { cik: string; name: string; tickers: string[]; sic: string; industry: string };
  requestedYears: number;
  periods: SecAnnualPeriod[];
  warnings: string[];
  coverage: 'requested-history-found' | 'partial-history';
  analysisReady: false;
  facts: {
    sourceUrl: string;
    downloadPath: string;
    retrievedAt: string;
    sha256: string;
    taxonomyCount: number;
    conceptCount: number;
  };
  submissionSources: { url: string; retrievedAt: string; sha256: string }[];
}

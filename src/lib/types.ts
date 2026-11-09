export const financialFields = [
  'revenue',
  'grossProfit',
  'ebit',
  'netIncome',
  'depreciation',
  'capex',
  'operatingNwc',
  'cashFromOperations',
  'totalAssets',
  'totalLiabilities',
  'currentAssets',
  'currentLiabilities',
  'cash',
  'shortTermInvestments',
  'receivables',
  'debt',
  'equity',
  'interestExpense',
] as const;

export type FinancialField = (typeof financialFields)[number];
export type FinancialYear = Record<FinancialField, number | null> & {
  fiscalYear: number;
  periodStart: string;
  periodEnd: string;
  currency: 'USD';
  scale: 'millions';
};

export interface Dataset {
  company: string;
  kind: 'demo' | 'upload' | 'sec';
  source: string;
  sourceHash?: string;
  years: FinancialYear[];
  /** A local SEC snapshot must be refreshed before valuation or server research. */
  restoredAt?: string;
  sec?: {
    cik: string;
    requestedYears: number;
    mappingVersion: string;
    sourceUrl: string;
    retrievedAt: string;
    evidence: Record<string, FactEvidence>;
    issues: string[];
    blockingIssues: string[];
    valuationBlock?: string;
    review?: {
      confirmed: boolean;
      notes: string;
      overrides: FactOverride[];
      valuationConfirmed?: boolean;
      valuationNotes?: string;
    };
  };
}

export interface FactCandidate {
  tag: string;
  value: number;
  rawValue: number;
  scale: 'millions';
  unit: 'USD';
  start?: string;
  end: string;
  accession: string;
  filed: string;
  form: string;
  url: string;
}
export interface FactEvidence {
  status: 'sourced' | 'missing' | 'conflict' | 'user-entered';
  reason: string;
  selected?: FactCandidate;
  candidates: FactCandidate[];
}
export interface FactOverride {
  id: string;
  value: number;
  reason: string;
}

export interface Assumptions {
  growth: number;
  margin: number;
  taxRate: number;
  daRate: number;
  capexRate: number;
  nwcRate: number;
  wacc: number;
  terminalGrowth: number;
  excessCash: number;
  debt: number;
  otherClaims: number;
  nonOperatingAssets: number;
  shares: number | null;
}

export type Scenario = 'Bear' | 'Base' | 'Bull';
export type View = 'Overview' | 'Financials' | 'Valuation' | 'Sources';

export interface Metric {
  id: string;
  label: string;
  category: string;
  value: number | null;
  unit: 'percent' | 'multiple' | 'money';
  formula: string;
  inputs: string[];
  reason?: string;
}

export const fieldLabels: Record<FinancialField, string> = {
  revenue: 'Revenue',
  grossProfit: 'Gross profit',
  ebit: 'Operating profit (EBIT)',
  netIncome: 'Net income to common shareholders',
  depreciation: 'Depreciation & amortization',
  capex: 'Capital expenditure',
  operatingNwc: 'Operating net working capital',
  cashFromOperations: 'Cash from operations',
  totalAssets: 'Total assets',
  totalLiabilities: 'Total liabilities',
  currentAssets: 'Current assets',
  currentLiabilities: 'Current liabilities',
  cash: 'Cash & equivalents',
  shortTermInvestments: 'Short-term investments',
  receivables: 'Receivables',
  debt: 'Interest-bearing debt',
  equity: 'Common equity',
  interestExpense: 'Gross interest expense',
};

export const factId = (year: number, field: FinancialField) => `FY${year}:${field}`;

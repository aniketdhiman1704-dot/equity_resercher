import type { Assumptions, Dataset, FinancialYear } from './types.ts';

// Intentionally synthetic. No real issuer, SEC filing, or market quote is represented.
const revenues = [5400, 6150, 6890, 7600, 8950, 10400, 11680, 12840];
const round = (n: number) => Math.round(n * 100) / 100;

export const sampleDataset: Dataset = {
  company: 'Northstar Systems',
  kind: 'demo',
  source: 'Synthetic teaching fixture · sample.ts · v1',
  years: revenues.map((revenue, i): FinancialYear => {
    const fiscalYear = 2018 + i;
    const totalAssets = round(revenue * 1.45);
    const totalLiabilities = round(revenue * 0.55);
    return {
      fiscalYear,
      periodStart: `${fiscalYear}-01-01`,
      periodEnd: `${fiscalYear}-12-31`,
      currency: 'USD',
      scale: 'millions',
      revenue,
      grossProfit: round(revenue * (0.59 + i * 0.006)),
      ebit: round(revenue * (0.164 + i * 0.008)),
      netIncome: round(revenue * (0.12 + i * 0.006)),
      depreciation: round(revenue * 0.035),
      capex: round(revenue * 0.045),
      operatingNwc: round(revenue * 0.12),
      cashFromOperations: round(revenue * 0.245),
      totalAssets,
      totalLiabilities,
      currentAssets: round(revenue * 0.55),
      currentLiabilities: round(revenue * 0.2),
      cash: round(revenue * 0.2),
      shortTermInvestments: round(revenue * 0.04),
      receivables: round(revenue * 0.15),
      debt: round(2300 - i * 80),
      equity: round(totalAssets - totalLiabilities),
      interestExpense: round((2300 - i * 80) * 0.05),
    };
  }),
};

export const sampleAssumptions: Assumptions = {
  growth: 0.08,
  margin: 0.23,
  taxRate: 0.25,
  daRate: 0.035,
  capexRate: 0.045,
  nwcRate: 0.12,
  wacc: 0.1,
  terminalGrowth: 0.025,
  excessCash: 1800,
  debt: 1740,
  otherClaims: 0,
  nonOperatingAssets: 0,
  shares: 640,
};

export const sampleReferencePrice = 38.5;

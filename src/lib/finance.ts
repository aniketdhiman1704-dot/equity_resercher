import {
  factId,
  type Assumptions,
  type Dataset,
  type FinancialYear,
  type Metric,
  type Scenario,
} from './types.ts';

export const CALCULATION_VERSION = '0.2.0';
const available = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);

export function cagr(first: number | null, last: number | null, intervals: number): number | null {
  if (
    !available(first) ||
    !available(last) ||
    first <= 0 ||
    last <= 0 ||
    !Number.isInteger(intervals) ||
    intervals <= 0
  )
    return null;
  const result = Math.expm1((Math.log(last) - Math.log(first)) / intervals);
  return Number.isFinite(result) ? result : null;
}

export function ratios(current: FinancialYear, previous?: FinancialYear): Metric[] {
  const p =
    previous?.fiscalYear === current.fiscalYear - 1 &&
    previous.currency === current.currency &&
    previous.scale === current.scale &&
    Date.parse(current.periodStart) - Date.parse(previous.periodEnd) === 86400000
      ? previous
      : undefined;
  const results: Metric[] = [];
  function ratio(
    id: string,
    label: string,
    category: string,
    numerator: number | null,
    denominator: number | null,
    unit: Metric['unit'],
    formula: string,
    inputs: string[],
    missing = 'Required inputs are missing or the denominator is not positive.',
  ) {
    const quotient =
      available(numerator) && available(denominator) && denominator > 0
        ? numerator / denominator
        : null;
    const value = available(quotient) ? quotient : null;
    results.push({
      id,
      label,
      category,
      value,
      unit,
      formula,
      inputs,
      reason: value === null ? missing : undefined,
    });
  }
  const refs = (...fields: Parameters<typeof factId>[1][]) =>
    fields.map((f) => factId(current.fiscalYear, f));
  ratio(
    'grossMargin',
    'Gross margin',
    'Profitability',
    current.grossProfit,
    current.revenue,
    'percent',
    'Gross profit / revenue',
    refs('grossProfit', 'revenue'),
  );
  ratio(
    'operatingMargin',
    'Operating margin',
    'Profitability',
    current.ebit,
    current.revenue,
    'percent',
    'Operating EBIT / revenue',
    refs('ebit', 'revenue'),
  );
  ratio(
    'netMargin',
    'Net margin',
    'Profitability',
    current.netIncome,
    current.revenue,
    'percent',
    'Net income to common shareholders / revenue',
    refs('netIncome', 'revenue'),
  );
  ratio(
    'currentRatio',
    'Current ratio',
    'Liquidity',
    current.currentAssets,
    current.currentLiabilities,
    'multiple',
    'Current assets / current liabilities',
    refs('currentAssets', 'currentLiabilities'),
  );
  const quickAssets = [current.cash, current.shortTermInvestments, current.receivables].every(
    available,
  )
    ? current.cash! + current.shortTermInvestments! + current.receivables!
    : null;
  ratio(
    'quickRatio',
    'Quick ratio',
    'Liquidity',
    quickAssets,
    current.currentLiabilities,
    'multiple',
    '(Cash + short-term investments + receivables) / current liabilities',
    refs('cash', 'shortTermInvestments', 'receivables', 'currentLiabilities'),
  );
  ratio(
    'debtEquity',
    'Debt / equity',
    'Leverage',
    current.debt,
    current.equity,
    'multiple',
    'Interest-bearing debt / common equity',
    refs('debt', 'equity'),
  );
  const netDebt = [current.debt, current.cash, current.shortTermInvestments].every(available)
    ? current.debt! - current.cash! - current.shortTermInvestments!
    : null;
  const ebitda =
    available(current.ebit) && available(current.depreciation)
      ? current.ebit + current.depreciation
      : null;
  ratio(
    'netDebtEbitda',
    'Net debt / EBITDA',
    'Leverage',
    netDebt,
    ebitda,
    'multiple',
    '(Debt − cash − short-term investments) / (EBIT + D&A)',
    refs('debt', 'cash', 'shortTermInvestments', 'ebit', 'depreciation'),
  );
  ratio(
    'interestCoverage',
    'Interest coverage',
    'Leverage',
    current.ebit,
    current.interestExpense,
    'multiple',
    'EBIT / gross interest expense',
    refs('ebit', 'interestExpense'),
  );
  for (const [id, field, label] of [
    ['roe', 'equity', 'Return on equity'],
    ['roa', 'totalAssets', 'Return on assets'],
  ] as const) {
    const opening = p?.[field];
    const closing = current[field];
    const average =
      available(opening) && available(closing) && opening > 0 && closing > 0
        ? opening / 2 + closing / 2
        : null;
    ratio(
      id,
      label,
      'Capital efficiency',
      current.netIncome,
      average,
      'percent',
      `Net income to common shareholders / average opening and closing ${field === 'equity' ? 'common equity' : 'total assets'}`,
      [...refs('netIncome', field), factId(current.fiscalYear - 1, field)],
      'Requires positive opening and closing balances for consecutive fiscal years.',
    );
  }
  ratio(
    'cashConversion',
    'Cash conversion',
    'Cash generation',
    current.cashFromOperations,
    current.netIncome,
    'multiple',
    'Cash from operations / net income',
    refs('cashFromOperations', 'netIncome'),
  );
  const cashAfterCapex =
    available(current.cashFromOperations) && available(current.capex)
      ? current.cashFromOperations - current.capex
      : null;
  results.push({
    id: 'cashAfterCapex',
    label: 'Cash flow after CapEx',
    category: 'Cash generation',
    value: available(cashAfterCapex) ? cashAfterCapex : null,
    unit: 'money',
    formula: 'Cash from operations − capital expenditure; this is not unlevered FCFF.',
    inputs: refs('cashFromOperations', 'capex'),
    reason: !available(cashAfterCapex)
      ? 'CFO or CapEx is missing or the result exceeds numerical limits.'
      : undefined,
  });
  return results;
}

export interface ForecastYear {
  year: number;
  revenue: number;
  ebit: number;
  nopat: number;
  depreciation: number;
  capex: number;
  nwc: number;
  deltaNwc: number;
  fcff: number;
  presentValue: number;
}

export function fcff(
  ebit: number,
  taxRate: number,
  depreciation: number,
  capex: number,
  deltaNwc: number,
): number {
  return ebit * (1 - taxRate) + depreciation - capex - deltaNwc;
}

export function bridgeToEquity(
  ev: number,
  a: Pick<Assumptions, 'excessCash' | 'nonOperatingAssets' | 'debt' | 'otherClaims'>,
): number {
  return ev + a.excessCash + a.nonOperatingAssets - a.debt - a.otherClaims;
}

export function scenarioAssumptions(a: Assumptions, scenario: Scenario): Assumptions {
  if (scenario === 'Base') return { ...a };
  const direction = scenario === 'Bull' ? 1 : -1;
  // A disclosed operating scenario; risk and financing assumptions stay fixed.
  return { ...a, growth: a.growth + direction * 0.02, margin: a.margin + direction * 0.02 };
}

export function valueCompany(latest: FinancialYear, a: Assumptions) {
  for (const [key, value] of Object.entries(a)) {
    if (key !== 'shares' && !Number.isFinite(value))
      throw new Error('Every assumption must be a finite number.');
  }
  if (!available(latest.revenue) || latest.revenue <= 0 || !available(latest.operatingNwc))
    throw new Error('DCF needs positive revenue and reported operating working capital.');
  if (!available(latest.ebit) || latest.ebit <= 0)
    throw new Error(
      'This first model supports profitable operating businesses. A turnaround needs a separate forecast.',
    );
  if (a.wacc <= 0 || a.wacc <= a.terminalGrowth)
    throw new Error('WACC must be positive and greater than terminal growth.');
  if (a.terminalGrowth < 0 || a.terminalGrowth > 0.06)
    throw new Error(
      'This stable-growth model supports terminal growth from 0% to 6%; justify the selected rate.',
    );
  if (a.growth <= -1 || a.margin <= 0 || a.margin > 1 || a.taxRate < 0 || a.taxRate >= 1)
    throw new Error(
      'Growth must exceed −100%, margin must be positive and at most 100%, and tax must be 0–99.9%.',
    );
  if (
    [a.daRate, a.capexRate, a.excessCash, a.debt, a.otherClaims, a.nonOperatingAssets].some(
      (v) => v < 0,
    )
  )
    throw new Error('D&A, CapEx, and equity-bridge inputs cannot be negative.');
  if (a.shares !== null && (!Number.isFinite(a.shares) || a.shares <= 0))
    throw new Error('Current diluted shares must be positive, or unavailable.');
  if (a.excessCash > 0 && !available(latest.cash))
    throw new Error('A positive excess-cash adjustment needs a reported cash balance.');
  if (available(latest.cash) && a.excessCash > latest.cash)
    throw new Error('Excess cash cannot exceed the reported cash balance.');
  const forecast: ForecastYear[] = [];
  let revenue = latest.revenue;
  let nwc = latest.operatingNwc;
  for (let i = 1; i <= 6; i++) {
    revenue *= 1 + (i === 6 ? a.terminalGrowth : a.growth);
    const nextNwc = revenue * a.nwcRate;
    const ebit = revenue * a.margin;
    const depreciation = revenue * a.daRate;
    const capex = revenue * a.capexRate;
    const cashFlow = fcff(ebit, a.taxRate, depreciation, capex, nextNwc - nwc);
    forecast.push({
      year: latest.fiscalYear + i,
      revenue,
      ebit,
      nopat: ebit * (1 - a.taxRate),
      depreciation,
      capex,
      nwc: nextNwc,
      deltaNwc: nextNwc - nwc,
      fcff: cashFlow,
      presentValue: cashFlow / (1 + a.wacc) ** i,
    });
    nwc = nextNwc;
  }
  const terminal = forecast[5];
  if (terminal.fcff <= 0)
    throw new Error('Stable-year FCFF must be positive for this terminal-value model.');
  const terminalReinvestment = terminal.capex - terminal.depreciation + terminal.deltaNwc;
  if (terminalReinvestment < 0 || (a.terminalGrowth > 0 && terminalReinvestment <= 0))
    throw new Error(
      'Positive terminal growth requires positive reinvestment; a stable business cannot release investment forever. Review CapEx, D&A, and working capital.',
    );
  const terminalValue = terminal.fcff / (a.wacc - a.terminalGrowth);
  const pvTerminal = terminalValue / (1 + a.wacc) ** 5;
  const pvForecast = forecast.slice(0, 5).reduce((sum, year) => sum + year.presentValue, 0);
  const enterpriseValue = pvForecast + pvTerminal;
  const equityValue = bridgeToEquity(enterpriseValue, a);
  const perShare = a.shares !== null && equityValue > 0 ? equityValue / a.shares : null;
  const reinvestmentRate = terminalReinvestment / terminal.nopat;
  const terminalRoic =
    reinvestmentRate > 0 && a.terminalGrowth > 0 ? a.terminalGrowth / reinvestmentRate : null;
  if (
    ![
      enterpriseValue,
      equityValue,
      terminalValue,
      pvTerminal,
      pvForecast,
      reinvestmentRate,
      ...(perShare === null ? [] : [perShare]),
      ...(terminalRoic === null ? [] : [terminalRoic]),
      ...forecast.flatMap((row) => Object.values(row)),
    ].every(Number.isFinite)
  )
    throw new Error('These inputs overflow the model. Use realistic operating assumptions.');
  return {
    forecast: forecast.slice(0, 5),
    terminal,
    terminalValue,
    pvTerminal,
    pvForecast,
    enterpriseValue,
    equityValue,
    perShare,
    terminalShare: enterpriseValue > 0 ? pvTerminal / enterpriseValue : null,
    terminalRoic,
    reinvestmentRate,
  };
}

export type Valuation = ReturnType<typeof valueCompany>;

export function tryValue(
  latest: FinancialYear,
  a: Assumptions,
): { value: Valuation | null; error: string | null } {
  try {
    return { value: valueCompany(latest, a), error: null };
  } catch (error) {
    return {
      value: null,
      error: error instanceof Error ? error.message : 'Unable to calculate valuation.',
    };
  }
}

/** Shared by the UI and workers: source approval is distinct from forecast approval. */
export function valuationReadiness(
  dataset: Dataset,
  assumptions: Assumptions | null,
): string | null {
  if (dataset.restoredAt)
    return 'Refresh SEC filings and review the mapping before valuing this saved snapshot.';
  if (dataset.sec?.valuationBlock) return dataset.sec.valuationBlock;
  if (dataset.kind === 'sec') {
    if (!dataset.sec?.review?.confirmed || dataset.sec.blockingIssues.length)
      return 'Review comparable historical SEC inputs before valuation.';
    if (
      !dataset.sec.review.valuationConfirmed ||
      (dataset.sec.review.valuationNotes?.trim().length ?? 0) < 20
    )
      return 'Historical analysis is available. Review DCF suitability and document lease/accounting scope in Review mappings before valuation.';
  }
  if (dataset.kind !== 'demo' && assumptions?.shares != null)
    return 'Public/private capitalization is unverified; per-share values remain withheld.';
  const latest = dataset.years.at(-1);
  if (!latest || dataset.years.length < 3)
    return 'At least three comparable annual periods are required.';
  const missing = (
    ['revenue', 'ebit', 'depreciation', 'capex', 'operatingNwc', 'debt'] as const
  ).filter((field) => !available(latest[field]));
  if (missing.length)
    return `Complete the latest historical inputs before DCF: ${missing.join(', ')}. Missing is not zero.`;
  return null;
}

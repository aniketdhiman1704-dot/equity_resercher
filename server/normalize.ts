import { z } from 'zod';
import { applySourceReview } from '../src/lib/review.ts';
import { statementIssues } from '../src/lib/statement-checks.ts';
import {
  financialFields,
  factId,
  type Dataset,
  type FinancialField,
  type FinancialYear,
  type FactCandidate,
  type FactEvidence,
} from '../src/lib/types.ts';
import type { SecCompanyReports } from '../src/lib/sec-types.ts';
import type { SecDocument } from './sec-client.ts';
import { SecError } from './errors.ts';

export const MAPPING_VERSION = 'sec-us-gaap-1';
// Alternatives have equivalent scope only. No fuzzy/custom-tag matching.
const mapping: Partial<Record<FinancialField, string[]>> = {
  revenue: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet'],
  grossProfit: ['GrossProfit'],
  ebit: ['OperatingIncomeLoss'],
  netIncome: ['NetIncomeLossAvailableToCommonStockholdersBasic'],
  depreciation: ['DepreciationDepletionAndAmortization'],
  capex: ['PaymentsToAcquirePropertyPlantAndEquipment'],
  cashFromOperations: ['NetCashProvidedByUsedInOperatingActivities'],
  totalAssets: ['Assets'],
  totalLiabilities: ['Liabilities'],
  currentAssets: ['AssetsCurrent'],
  currentLiabilities: ['LiabilitiesCurrent'],
  cash: ['CashAndCashEquivalentsAtCarryingValue'],
  shortTermInvestments: ['ShortTermInvestments'],
  receivables: ['AccountsReceivableNetCurrent'],
  interestExpense: ['InterestExpenseNonOperating'],
};
const duration = new Set<FinancialField>([
  'revenue',
  'grossProfit',
  'ebit',
  'netIncome',
  'depreciation',
  'capex',
  'cashFromOperations',
  'interestExpense',
]);
const signed = new Set<FinancialField>([
  'grossProfit',
  'ebit',
  'netIncome',
  'cashFromOperations',
  'operatingNwc',
  'equity',
]);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
const rawFact = z.object({
  start: date.optional(),
  end: date,
  val: z.number().finite(),
  accn: z.string().regex(/^\d{10}-\d{2}-\d{6}$/),
  form: z.enum(['10-K', '10-K/A']),
  filed: date,
});
const days = (start: string, end: string) => (Date.parse(end) - Date.parse(start)) / 86400000 + 1;
function candidates(
  raw: unknown,
  tags: string[],
  end: string,
  isDuration: boolean,
  cik: string,
): FactCandidate[] {
  const concepts = (
    raw as { facts?: { 'us-gaap'?: Record<string, { units?: { USD?: unknown[] } }> } }
  )?.facts?.['us-gaap'];
  const result: FactCandidate[] = [];
  for (const tag of tags) {
    const entries = concepts?.[tag]?.units?.USD;
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      const parsed = rawFact.safeParse(entry);
      if (!parsed.success) continue;
      const f = parsed.data;
      if (f.end !== end || f.filed < f.end || f.filed > new Date().toISOString().slice(0, 10))
        continue;
      if (
        isDuration
          ? !f.start || days(f.start, f.end) < 350 || days(f.start, f.end) > 380
          : f.start !== undefined
      )
        continue;
      result.push({
        tag: `us-gaap:${tag}`,
        value: f.val / 1e6,
        rawValue: f.val,
        scale: 'millions',
        unit: 'USD',
        start: f.start,
        end: f.end,
        accession: f.accn,
        filed: f.filed,
        form: f.form,
        url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${f.accn.replaceAll('-', '')}/${f.accn}-index.html`,
      });
    }
  }
  return result.sort((a, b) => b.filed.localeCompare(a.filed) || a.tag.localeCompare(b.tag));
}
function select(values: FactCandidate[], field: FinancialField): FactEvidence {
  if (!values.length)
    return {
      status: 'missing',
      reason: mapping[field]
        ? 'No supported USD annual fact with the required scope and dates.'
        : 'Manual statement mapping required: operating NWC, total debt and common equity cannot be inferred safely from broad balance-sheet totals.',
      candidates: [],
    };
  const latest = values.filter((v) => v.filed === values[0].filed);
  if (new Set(latest.map((v) => `${v.start}:${v.value}`)).size > 1)
    return {
      status: 'conflict',
      reason: 'Conflicting values or annual contexts on the latest filing date; no value selected.',
      candidates: values,
    };
  const selected = latest[0];
  if (!signed.has(field) && selected.value < 0)
    return {
      status: 'conflict',
      reason: 'Unexpected negative value for this input; sign requires source review.',
      candidates: values,
    };
  const changed = values.some((v) => v.value !== selected.value);
  return {
    status: 'sourced',
    selected,
    candidates: values,
    reason: changed
      ? 'Latest filed annual disclosure selected; differing earlier values retained. Review comparative restatements or tag changes.'
      : 'Latest filed annual USD disclosure selected; original USD divided by 1,000,000.',
  };
}

export function normalizeReports(reports: SecCompanyReports, document: SecDocument): Dataset {
  if (document.sha256 !== reports.facts.sha256)
    throw new SecError('SEC_SOURCE_CHANGED', 'Facts changed. Refresh the filing lookup.', 409);
  const evidence: Record<string, FactEvidence> = {};
  const issues = [...reports.warnings];
  const blockingIssues: string[] = [];
  const years: FinancialYear[] = [];
  for (const period of [...reports.periods].sort((a, b) =>
    a.periodEnd.localeCompare(b.periodEnd),
  )) {
    const fiscalYear = Number(period.periodEnd.slice(0, 4));
    const row = {
      fiscalYear,
      periodEnd: period.periodEnd,
      currency: 'USD',
      scale: 'millions',
    } as FinancialYear;
    for (const field of financialFields) {
      const entry = select(
        candidates(
          document.data,
          mapping[field] ?? [],
          period.periodEnd,
          duration.has(field),
          reports.company.cik,
        ),
        field,
      );
      evidence[factId(fiscalYear, field)] = entry;
      row[field] = entry.selected?.value ?? null;
    }
    // Anchor the annual context to revenue; never infer a full year from instant balances.
    const start = evidence[factId(fiscalYear, 'revenue')].selected?.start;
    if (!start)
      blockingIssues.push(
        `FY${fiscalYear}: no unambiguous full-year revenue context. Transition periods and unsupported mappings need separate review.`,
      );
    row.periodStart = start ?? '';
    for (const field of duration) {
      const entry = evidence[factId(fiscalYear, field)];
      if (entry.selected && entry.selected.start !== start) {
        row[field] = null;
        entry.status = 'conflict';
        entry.reason =
          'Annual start date differs from revenue; excluded from comparable calculations.';
        delete entry.selected;
      }
    }
    if (row.cash !== null && row.currentAssets !== null && row.cash > row.currentAssets)
      blockingIssues.push(
        `FY${fiscalYear}: cash exceeds current assets; reconcile scope before use.`,
      );
    blockingIssues.push(...statementIssues(row).map((issue) => `FY${fiscalYear}: ${issue}`));
    const totalEquity = select(
      candidates(
        document.data,
        ['StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
        period.periodEnd,
        false,
        reports.company.cik,
      ),
      'equity',
    ).selected?.value;
    if (
      row.totalAssets !== null &&
      row.totalLiabilities !== null &&
      totalEquity !== undefined &&
      Math.abs(row.totalAssets - row.totalLiabilities - totalEquity) >
        Math.max(0.000001, Math.abs(row.totalAssets) * 0.001)
    )
      blockingIssues.push(
        `FY${fiscalYear}: assets do not reconcile to liabilities plus total equity within 0.1% of assets.`,
      );
    years.push(row);
  }
  if (years.length < 3)
    blockingIssues.push('At least three comparable annual periods are required.');
  for (let i = 1; i < years.length; i++) {
    if (
      years[i].fiscalYear !== years[i - 1].fiscalYear + 1 ||
      days(years[i - 1].periodEnd, years[i].periodStart) !== 2
    )
      blockingIssues.push('Annual periods have gaps, overlaps or duplicate fiscal-year labels.');
  }
  const missing = Object.values(evidence).filter((e) => !e.selected).length;
  issues.push(
    `${missing} inputs were unavailable before manual review. Manual entries are labelled separately; remaining missing values are never replaced with zero.`,
    'Latest available annual disclosures may restate earlier years; this is not point-in-time research.',
    'Debt, operating NWC, common equity and capitalization require explicit scope review. Custom tags and foreign issuers are not mapped.',
  );
  const sic = Number(reports.company.sic);
  return {
    company: reports.company.name,
    kind: 'sec',
    source: `SEC Company Facts · CIK ${reports.company.cik}`,
    sourceHash: document.sha256,
    years,
    sec: {
      cik: reports.company.cik,
      requestedYears: reports.requestedYears,
      mappingVersion: MAPPING_VERSION,
      sourceUrl: document.url,
      retrievedAt: document.retrievedAt,
      evidence,
      issues,
      blockingIssues,
      valuationBlock:
        sic >= 6000 && sic < 6800
          ? 'Financial issuers and REITs require a sector-specific valuation model.'
          : undefined,
    },
  };
}

export { reviewSchema } from '../src/lib/review.ts';
export function reviewDataset(dataset: Dataset, raw: unknown): Dataset {
  try {
    return applySourceReview(dataset, raw);
  } catch (error) {
    throw new SecError(
      'INVALID_REVIEW',
      error instanceof Error ? error.message : 'Invalid source review.',
      400,
    );
  }
}

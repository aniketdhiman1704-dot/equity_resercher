import { z } from 'zod';
import { reviewSchema } from './review';
import { statementIssues } from './statement-checks';
import { CALCULATION_VERSION } from './finance';
import { datasetCsv, parseFinancialCsv } from './csv';
import { sampleDataset } from './sample';
import { financialFields, factId, type Assumptions, type Dataset, type Scenario } from './types';

export const SESSION_VERSION = 1;
export const MAX_SESSION_BYTES = 5_000_000;
const number = z.number().finite().min(-1e12).max(1e12);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
const text = z.string().max(4000);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const fieldId = z.string().regex(new RegExp(`^FY\\d{4}:(${financialFields.join('|')})$`));
const candidate = z
  .object({
    tag: z.string().regex(/^us-gaap:[A-Za-z0-9]+$/),
    value: number,
    rawValue: z.number().finite(),
    scale: z.literal('millions'),
    unit: z.literal('USD'),
    start: date.optional(),
    end: date,
    accession: z.string().regex(/^\d{10}-\d{2}-\d{6}$/),
    filed: date,
    form: z.enum(['10-K', '10-K/A']),
    url: z.string().max(500),
  })
  .strict();
const evidence = z
  .object({
    status: z.enum(['sourced', 'missing', 'conflict', 'user-entered']),
    reason: text,
    selected: candidate.optional(),
    candidates: z.array(candidate).max(500),
  })
  .strict();
const secSchema = z
  .object({
    cik: z.string().regex(/^\d{10}$/),
    requestedYears: z.number().int().min(3).max(7),
    mappingVersion: z.string().min(1).max(100),
    sourceUrl: z.string().max(500),
    retrievedAt: z.iso.datetime(),
    evidence: z.record(fieldId, evidence),
    issues: z.array(text).max(150),
    blockingIssues: z.array(text).max(150),
    valuationBlock: text.optional(),
    review: reviewSchema,
  })
  .strict();
const rowSchema = z
  .object({
    fiscalYear: z.number().int().min(1900).max(2200),
    periodStart: date,
    periodEnd: date,
    currency: z.literal('USD'),
    scale: z.literal('millions'),
    ...Object.fromEntries(financialFields.map((f) => [f, number.nullable()])),
  })
  .strict();
const datasetSchema = z
  .object({
    company: z.string().trim().min(1).max(300),
    kind: z.enum(['demo', 'upload', 'sec']),
    source: z.string().min(1).max(1000),
    sourceHash: hash.optional(),
    years: z.array(rowSchema).min(3).max(8),
    sec: secSchema.optional(),
  })
  .strict();
const assumptionKeys = [
  'growth',
  'margin',
  'taxRate',
  'daRate',
  'capexRate',
  'nwcRate',
  'wacc',
  'terminalGrowth',
  'excessCash',
  'debt',
  'otherClaims',
  'nonOperatingAssets',
  'shares',
] as const;
const assumptionsSchema = z
  .object(Object.fromEntries(assumptionKeys.map((k) => [k, number.nullable()])))
  .strict();
const sessionSchema = z
  .object({
    format: z.literal('equity-research-session'),
    version: z.literal(SESSION_VERSION),
    calculationVersion: z.enum(['0.1.0', CALCULATION_VERSION]),
    savedAt: z.iso.datetime(),
    assumptionNotes: z.string().max(4000).default(''),
    data: datasetSchema,
    assumptions: assumptionsSchema,
    historyLength: z.number().int().min(3).max(7),
    scenario: z.enum(['Bear', 'Base', 'Bull']),
  })
  .strict();
export interface RestoredSession {
  dataset: Dataset;
  assumptions: Assumptions;
  historyLength: number;
  scenario: Scenario;
  savedAt: string;
  assumptionNotes: string;
}
const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86400000 + 1;

function validateDataset(data: Dataset) {
  if (data.kind !== 'sec') {
    if (data.sec) throw new Error('Only public SEC sessions may carry SEC evidence.');
    parseFinancialCsv(datasetCsv(data));
    if (
      data.kind === 'demo' &&
      (data.company !== sampleDataset.company ||
        data.source !== sampleDataset.source ||
        datasetCsv(data) !== datasetCsv(sampleDataset))
    )
      throw new Error(
        'The synthetic sample was modified. Import custom company data through the CSV review workflow.',
      );
  } else {
    const sec = data.sec;
    if (
      !sec ||
      !data.sourceHash ||
      sec.blockingIssues.length ||
      data.years.length > 7 ||
      data.years.length > sec.requestedYears
    )
      throw new Error('This SEC session lacks accepted source metadata or has blocked history.');
    if (sec.sourceUrl !== `https://data.sec.gov/api/xbrl/companyfacts/CIK${sec.cik}.json`)
      throw new Error('The SEC source URL does not match the issuer.');
    const expectedIds = data.years.flatMap((y) =>
      financialFields.map((f) => factId(y.fiscalYear, f)),
    );
    if (
      Object.keys(sec.evidence).length !== expectedIds.length ||
      expectedIds.some((id) => !Object.hasOwn(sec.evidence, id))
    )
      throw new Error('SEC evidence does not cover the saved input fields.');
    for (const y of data.years) {
      if (
        days(y.periodStart, y.periodEnd) < 350 ||
        days(y.periodStart, y.periodEnd) > 380 ||
        y.fiscalYear !== Number(y.periodEnd.slice(0, 4))
      )
        throw new Error('SEC history must contain comparable full fiscal years.');
      for (const f of financialFields) {
        const item = sec.evidence[factId(y.fiscalYear, f)];
        for (const c of [...item.candidates, ...(item.selected ? [item.selected] : [])]) {
          const url = `https://www.sec.gov/Archives/edgar/data/${Number(sec.cik)}/${c.accession.replaceAll('-', '')}/${c.accession}-index.html`;
          if (
            c.url !== url ||
            c.end !== y.periodEnd ||
            c.rawValue / 1e6 !== c.value ||
            c.filed < c.end
          )
            throw new Error('SEC evidence has an inconsistent period, scale or filing link.');
        }
        if (
          item.status === 'sourced' &&
          (!item.selected ||
            item.selected.value !== y[f] ||
            !item.candidates.some((c) => JSON.stringify(c) === JSON.stringify(item.selected)))
        )
          throw new Error('Saved financial values do not match their selected SEC evidence.');
        if (item.status !== 'sourced' && item.selected)
          throw new Error('Only sourced inputs may have a selected filing fact.');
        if ((item.status === 'missing' || item.status === 'conflict') && y[f] !== null)
          throw new Error('Unavailable SEC inputs cannot contain a financial value.');
        if (
          item.status === 'user-entered' &&
          !sec.review!.overrides.some(
            (o) => o.id === factId(y.fiscalYear, f) && o.value === y[f] && o.reason === item.reason,
          )
        )
          throw new Error('Manual financial values need their original review rationale.');
      }
    }
  }
  for (let i = 0; i < data.years.length; i++) {
    const y = data.years[i];
    if (Date.parse(`${y.periodEnd}T23:59:59Z`) >= Date.now())
      throw new Error('Historical periods must be completed.');
    if (
      i > 0 &&
      (y.fiscalYear !== data.years[i - 1].fiscalYear + 1 ||
        days(data.years[i - 1].periodEnd, y.periodStart) !== 2)
    )
      throw new Error('Saved fiscal years must be ordered, unique and consecutive.');
    for (const f of financialFields) {
      if (
        ![
          'grossProfit',
          'ebit',
          'netIncome',
          'cashFromOperations',
          'operatingNwc',
          'equity',
        ].includes(f) &&
        y[f] !== null &&
        y[f]! < 0
      )
        throw new Error('An input has an unsupported negative sign.');
    }
    const issues = statementIssues(
      y,
      data.kind !== 'sec' || !!data.sec?.review?.valuationConfirmed,
    );
    if (issues.length) throw new Error(issues.join(' '));
    if (y.cash !== null && y.currentAssets !== null && y.cash > y.currentAssets)
      throw new Error('Cash exceeds current assets.');
  }
}

export function parseSession(content: string): RestoredSession {
  if (new TextEncoder().encode(content).length > MAX_SESSION_BYTES)
    throw new Error('Keep session files under 5 MB.');
  let raw: unknown;
  try {
    raw = JSON.parse(content.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error('This is not a valid JSON session file.');
  }
  const parsed = sessionSchema.safeParse(raw);
  if (!parsed.success)
    throw new Error(
      'This file is not a supported session. Choose a file created by Save session in this version; research-report exports are a separate format.',
    );
  const saved = parsed.data;
  const dataset = saved.data as Dataset;
  validateDataset(dataset);
  if (saved.historyLength > dataset.years.length)
    throw new Error('The selected history is longer than the saved data.');
  const assumptions = Object.fromEntries(
    assumptionKeys.map((k) => [
      k,
      k === 'shares' ? saved.assumptions[k] : (saved.assumptions[k] ?? NaN),
    ]),
  ) as unknown as Assumptions;
  if (dataset.kind !== 'demo' && assumptions.shares !== null)
    throw new Error(
      'Non-sample capitalization is unverified. Per-share inputs cannot be restored.',
    );
  if (dataset.kind === 'sec') dataset.restoredAt = new Date().toISOString();
  return {
    dataset,
    assumptions,
    historyLength: saved.historyLength,
    scenario: saved.scenario,
    savedAt: saved.savedAt,
    assumptionNotes: saved.assumptionNotes,
  };
}

export function serializeSession(
  dataset: Dataset,
  assumptions: Assumptions,
  historyLength: number,
  scenario: Scenario,
  assumptionNotes = '',
): string {
  const { restoredAt: _restoredAt, ...data } = dataset;
  const result = JSON.stringify(
    {
      format: 'equity-research-session',
      version: SESSION_VERSION,
      calculationVersion: CALCULATION_VERSION,
      savedAt: new Date().toISOString(),
      assumptionNotes,
      data,
      assumptions: Object.fromEntries(
        assumptionKeys.map((k) => [k, Number.isFinite(assumptions[k]) ? assumptions[k] : null]),
      ),
      historyLength,
      scenario,
    },
    null,
    2,
  );
  // Save and open share a contract. Never offer a download that cannot be reopened.
  parseSession(result);
  return result;
}

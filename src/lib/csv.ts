import Papa from 'papaparse';
import { statementIssues } from './statement-checks';
import { z } from 'zod';
import { financialFields, type FinancialYear, type Dataset } from './types';

export const csvHeaders = [
  'fiscalYear',
  'periodStart',
  'periodEnd',
  'currency',
  'scale',
  ...financialFields,
];
const nullableNumber = z.number().finite().min(-1e12).max(1e12).nullable();
const rowSchema = z
  .object({
    fiscalYear: z.number().int().min(1900).max(2200),
    periodStart: z.string(),
    periodEnd: z.string(),
    currency: z.literal('USD'),
    scale: z.literal('millions'),
    ...Object.fromEntries(financialFields.map((field) => [field, nullableNumber])),
  })
  .strict();

export function parseFinancialCsv(text: string): FinancialYear[] {
  if (text.length > 1_000_000)
    throw new Error('Keep the CSV under 1 MB. This template only needs 3–8 annual rows.');
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  });
  if (parsed.errors.length) throw new Error(`CSV could not be read: ${parsed.errors[0].message}`);
  const headers = parsed.meta.fields ?? [];
  if (headers.length !== csvHeaders.length || csvHeaders.some((h) => !headers.includes(h)))
    throw new Error(
      'Columns must match the template. Download the CSV template and retain every header; leave unavailable values blank.',
    );
  if (parsed.data.length < 3 || parsed.data.length > 8)
    throw new Error(
      'Provide 3–7 annual periods, plus at most one supporting opening year (8 rows maximum).',
    );
  const number = (value: string, row: number, field: string): number | null => {
    if (value.trim() === '') return null;
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim()))
      throw new Error(
        `Row ${row}: ${field} must be a plain number in millions, or blank. Do not use currency symbols or thousands separators.`,
      );
    return Number(value);
  };
  const rows = parsed.data
    .map((raw, i) => {
      const input = {
        ...raw,
        fiscalYear: number(raw.fiscalYear, i + 2, 'fiscalYear'),
        ...Object.fromEntries(financialFields.map((f) => [f, number(raw[f], i + 2, f)])),
      };
      const result = rowSchema.safeParse(input);
      if (!result.success)
        throw new Error(
          `Row ${i + 2}: ${result.error.issues[0].path.join('.')} — ${result.error.issues[0].message}. Only USD millions are supported in this version.`,
        );
      const row = result.data as FinancialYear;
      if (
        row.periodStart !== `${row.fiscalYear}-01-01` ||
        row.periodEnd !== `${row.fiscalYear}-12-31`
      )
        throw new Error(
          `FY${row.fiscalYear}: use full January–December fiscal years. Other fiscal calendars require a later adapter.`,
        );
      if (new Date(`${row.periodEnd}T23:59:59Z`).getTime() >= Date.now())
        throw new Error(
          `FY${row.fiscalYear}: historical statements must cover a completed fiscal year.`,
        );
      for (const field of [
        'revenue',
        'depreciation',
        'capex',
        'totalAssets',
        'totalLiabilities',
        'currentAssets',
        'currentLiabilities',
        'cash',
        'shortTermInvestments',
        'receivables',
        'debt',
        'interestExpense',
      ] as const) {
        if (row[field] !== null && row[field]! < 0)
          throw new Error(
            `FY${row.fiscalYear}: ${field} must be nonnegative. Normalize signs explicitly; CapEx is a positive cash outflow.`,
          );
      }
      if (row.totalAssets !== null && row.totalLiabilities !== null && row.equity !== null) {
        const tolerance = Math.max(1, row.totalAssets * 0.001);
        if (Math.abs(row.totalAssets - row.totalLiabilities - row.equity) > tolerance)
          throw new Error(
            `FY${row.fiscalYear}: assets do not reconcile to liabilities + common equity. This template assumes no non-controlling or preferred equity interests.`,
          );
      }
      if (row.cash !== null && row.currentAssets !== null && row.cash > row.currentAssets)
        throw new Error(
          `FY${row.fiscalYear}: cash exceeds current assets. Check units and mapping.`,
        );
      const issues = statementIssues(row, true);
      if (issues.length) throw new Error(`FY${row.fiscalYear}: ${issues.join(' ')}`);
      return row;
    })
    .sort((a, b) => a.fiscalYear - b.fiscalYear);
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].fiscalYear !== rows[i - 1].fiscalYear + 1)
      throw new Error(
        'Fiscal years must be unique and consecutive. Do not fill missing years with zero.',
      );
  }
  return rows;
}

export function datasetCsv(dataset: Dataset): string {
  return Papa.unparse({
    fields: csvHeaders,
    data: dataset.years.map((row) =>
      csvHeaders.map((key) => row[key as keyof FinancialYear] ?? ''),
    ),
  });
}

export function downloadFile(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function sourceHash(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

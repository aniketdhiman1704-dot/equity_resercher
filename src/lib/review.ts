import { z } from 'zod';
import { financialFields, factId, type Dataset, type FinancialField } from './types.ts';
import { statementIssues } from './statement-checks.ts';
const signed = new Set([
  'grossProfit',
  'ebit',
  'netIncome',
  'cashFromOperations',
  'operatingNwc',
  'equity',
]);

export const reviewSchema = z
  .object({
    confirmed: z.literal(true),
    notes: z.string().trim().min(10).max(2000),
    valuationConfirmed: z.boolean().default(false),
    valuationNotes: z.string().trim().max(2000).default(''),
    overrides: z
      .array(
        z
          .object({
            id: z.string().max(60),
            value: z.number().finite().min(-1e12).max(1e12),
            reason: z.string().trim().min(10).max(1000),
          })
          .strict(),
      )
      .max(133),
  })
  .strict()
  .refine((v) => !v.valuationConfirmed || v.valuationNotes.length >= 20, {
    message: 'Explain valuation scope, lease treatment and capital claims.',
  });
export function applySourceReview(dataset: Dataset, raw: unknown): Dataset {
  const parsed = reviewSchema.safeParse(raw);
  if (!parsed.success)
    throw new Error(
      'Confirm source review and supply a specific review note; each manual mapping needs a rationale.',
    );
  if (!dataset.sec || dataset.sec.blockingIssues.length)
    throw new Error('Annual history failed comparability checks; it cannot be accepted.');
  const next = structuredClone(dataset);
  // Re-review starts from source facts: removed manual entries must return to missing/conflict.
  for (const year of next.years)
    for (const field of financialFields) {
      const entry = next.sec!.evidence[factId(year.fiscalYear, field)];
      if (entry.status === 'user-entered') {
        year[field] = null;
        entry.status = entry.candidates.length ? 'conflict' : 'missing';
        entry.reason = 'Manual entry removed; source mapping remains unavailable.';
      }
    }
  const ids = new Set<string>();
  for (const override of parsed.data.overrides) {
    if (ids.has(override.id)) throw new Error('Duplicate manual input.');
    ids.add(override.id);
    const [fy, key] = override.id.split(':');
    const field = key as FinancialField;
    const year = next.years.find((y) => `FY${y.fiscalYear}` === fy);
    const prior = next.sec!.evidence[override.id];
    if (
      !year ||
      !financialFields.includes(field) ||
      !prior ||
      prior.selected ||
      (!signed.has(field) && override.value < 0)
    )
      throw new Error(
        'Manual values must fill unavailable inputs with valid signs. Sourced values are preserved.',
      );
    year[field] = override.value;
    next.sec!.evidence[override.id] = { ...prior, status: 'user-entered', reason: override.reason };
  }
  next.sec!.review = parsed.data;
  for (const year of next.years) {
    const issues = statementIssues(year, parsed.data.valuationConfirmed);
    if (issues.length) throw new Error(`FY${year.fiscalYear}: ${issues.join(' ')}`);
    if (year.cash !== null && year.currentAssets !== null && year.cash > year.currentAssets)
      throw new Error(
        'Manual mapping makes cash exceed current assets. Reconcile scope before use.',
      );
  }
  return next;
}

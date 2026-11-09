import { z } from 'zod';
import { sampleDataset } from '../src/lib/sample.ts';
import { SecError } from './errors.ts';
import { normalizeReports, reviewDataset, reviewSchema } from './normalize.ts';
import { runResearch } from '../src/lib/research.ts';
import type { SecService } from './sec-service.ts';

const n = z.number().finite();
export const researchSchema = z
  .object({
    historyYears: z.number().int().min(3).max(7).default(5),
    source: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('demo') }).strict(),
      z
        .object({
          kind: z.literal('sec'),
          cik: z.string().regex(/^\d{10}$/),
          years: z.number().int().min(3).max(7),
          sha256: z.string().regex(/^[a-f0-9]{64}$/),
          review: reviewSchema,
        })
        .strict(),
    ]),
    assumptions: z
      .object({
        growth: n,
        margin: n,
        taxRate: n,
        daRate: n,
        capexRate: n,
        nwcRate: n,
        wacc: n,
        terminalGrowth: n,
        excessCash: n,
        debt: n,
        otherClaims: n,
        nonOperatingAssets: n,
        shares: n.nullable(),
      })
      .strict()
      .nullable(),
    approved: z.boolean(),
    assumptionNotes: z.string().trim().max(4000).default(''),
  })
  .strict();

export async function research(service: SecService, raw: unknown) {
  const parsed = researchSchema.safeParse(raw);
  if (!parsed.success)
    throw new SecError(
      'INVALID_RESEARCH_REQUEST',
      'Use a reviewed public dataset or the synthetic sample, with valid numerical assumptions. Private uploads are not accepted.',
      400,
    );
  const request = parsed.data;
  let dataset = sampleDataset;
  let reports;
  if (request.source.kind === 'sec') {
    reports = await service.companyReports(request.source.cik, request.source.years);
    if (reports.facts.sha256 !== request.source.sha256)
      throw new SecError(
        'SEC_SOURCE_CHANGED',
        'The SEC source changed since review. Refresh and review before running research.',
        409,
      );
    dataset = reviewDataset(
      normalizeReports(reports, await service.companyFacts(request.source.cik)),
      request.source.review,
    );
    if (request.assumptions?.shares !== null && request.assumptions?.shares !== undefined)
      throw new SecError(
        'UNVERIFIED_SHARES',
        'Public capitalization is not verified; per-share values remain withheld.',
        400,
      );
  }
  dataset = { ...dataset, years: dataset.years.slice(-request.historyYears) };
  if (reports)
    reports = {
      ...reports,
      periods: reports.periods.filter((p) =>
        dataset.years.some((y) => y.periodEnd === p.periodEnd),
      ),
    };
  return runResearch(
    dataset,
    request.assumptions,
    request.approved,
    reports,
    request.assumptionNotes,
  );
}

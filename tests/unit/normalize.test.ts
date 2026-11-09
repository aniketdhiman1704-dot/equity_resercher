import { describe, expect, it } from 'vitest';
import { normalizeReports, reviewDataset } from '../../server/normalize';
import { ratios } from '../../src/lib/finance';
import { financialRecords, normalizedFixture } from '../fixtures/financials';
import { factsUrl } from '../fixtures/sec';

describe('annual normalization and source review', () => {
  it('keeps 3–7 full fiscal periods, USD scaling, source metadata and legitimate zero values', async () => {
    for (const count of [3, 5, 7]) {
      const { dataset } = await normalizedFixture(undefined, count);
      expect(dataset.years).toHaveLength(count);
      expect(dataset.sec!.blockingIssues).toEqual([]);
      expect(dataset.years.at(-1)).toMatchObject({
        revenue: 1000,
        shortTermInvestments: 0,
        periodStart: '2024-07-01',
        periodEnd: '2025-06-30',
      });
      expect(dataset.sec!.evidence['FY2025:revenue'].selected).toMatchObject({
        value: 1000,
        tag: 'us-gaap:Revenues',
        unit: 'USD',
        accession: '0000789019-25-000001',
      });
    }
  });
  it('selects comparative restatements by actual period, not filing fiscal-year labels, preserving earlier values', async () => {
    const setup = financialRecords();
    const list = setup.concepts.Revenues.units.USD;
    list.push({
      ...list[4],
      val: 1100e6,
      filed: '2025-08-15',
      fy: 2025,
      accn: '0000789019-25-000002',
      form: '10-K/A',
    });
    const { dataset } = await normalizedFixture(setup);
    expect(dataset.years.find((y) => y.fiscalYear === 2023)!.revenue).toBe(1100);
    expect(dataset.sec!.evidence['FY2023:revenue'].candidates).toHaveLength(2);
    expect(dataset.sec!.evidence['FY2023:revenue'].reason).toContain('differing earlier');
  });
  it('rejects quarters, invalid units and conflicting latest values without substituting older data', async () => {
    const setup = financialRecords();
    const list = setup.concepts.Revenues.units.USD;
    list.push({ ...list[6], start: '2025-04-01', val: 500e6, filed: '2025-09-01' });
    const first = await normalizedFixture(setup);
    expect(first.dataset.years.at(-1)!.revenue).toBe(1000);
    list.push({ ...list[6], val: 900e6 });
    const conflict = await normalizedFixture(setup);
    expect(conflict.dataset.years.at(-1)!.revenue).toBeNull();
    expect(conflict.dataset.sec!.blockingIssues.join(' ')).toContain('revenue context');
    delete setup.concepts.Revenues;
    (setup.records[factsUrl] as { facts: unknown }).facts = {
      'us-gaap': { Revenues: { units: { EUR: [list[6]] } } },
    };
    expect((await normalizedFixture(setup)).dataset.years.at(-1)!.revenue).toBeNull();
  });
  it('excludes incompatible duration starts and blocks shortened transition years and gaps', async () => {
    const setup = financialRecords();
    setup.concepts.OperatingIncomeLoss.units.USD[6].start = '2024-06-29';
    const { dataset } = await normalizedFixture(setup);
    expect(dataset.years.at(-1)!.ebit).toBeNull();
    expect(dataset.sec!.evidence['FY2025:ebit'].status).toBe('conflict');
    setup.concepts.Revenues.units.USD[6].start = '2025-01-01';
    expect((await normalizedFixture(setup)).dataset.sec!.blockingIssues.length).toBeGreaterThan(0);
    const good = await normalizedFixture();
    good.reports.periods = good.reports.periods.filter((p) => p.periodEnd !== '2023-06-30');
    expect(normalizeReports(good.reports, good.document).sec!.blockingIssues.join(' ')).toContain(
      'gaps',
    );
  });
  it('leaves ambiguous accounting scopes missing and withholds affected ratios', async () => {
    const { dataset } = await normalizedFixture();
    const latest = dataset.years.at(-1)!;
    expect(latest.debt).toBeNull();
    expect(latest.operatingNwc).toBeNull();
    expect(latest.equity).toBeNull();
    expect(ratios(latest, dataset.years.at(-2)).find((m) => m.id === 'roe')!.value).toBeNull();
    expect(ratios(dataset.years[0]).find((m) => m.id === 'roa')!.value).toBeNull();
  });
  it('checks signs, source fingerprints, consolidated balance-sheet reconciliation and sector suitability', async () => {
    const setup = financialRecords();
    setup.concepts.PaymentsToAcquirePropertyPlantAndEquipment.units.USD[6].val = -1;
    setup.concepts.Assets.units.USD[6].val = 4000e6;
    const { dataset, reports, document } = await normalizedFixture(setup);
    expect(dataset.years.at(-1)!.capex).toBeNull();
    expect(dataset.sec!.blockingIssues.join(' ')).toContain('reconcile');
    expect(() => normalizeReports(reports, { ...document, sha256: 'wrong' })).toThrow('changed');
    reports.company.sic = '6021';
    expect(normalizeReports(reports, document).sec!.valuationBlock).toContain('sector-specific');
  });
  it('records manual mappings with rationale and rejects replacing sourced values, duplicates, invalid signs and unreviewed history', async () => {
    const { dataset } = await normalizedFixture();
    const review = {
      confirmed: true,
      notes: 'Checked annual statement definitions.',
      overrides: [
        {
          id: 'FY2025:operatingNwc',
          value: -20,
          reason: 'Operating receivables plus inventory less operating payables, note 5.',
        },
        { id: 'FY2025:debt', value: 300, reason: 'Current plus non-current borrowing in note 8.' },
      ],
    };
    const accepted = reviewDataset(dataset, review);
    expect(accepted.years.at(-1)!.operatingNwc).toBe(-20);
    expect(accepted.sec!.evidence['FY2025:debt'].status).toBe('user-entered');
    expect(dataset.years.at(-1)!.debt).toBeNull();
    expect(() => reviewDataset(dataset, { ...review, confirmed: false })).toThrow('Confirm');
    expect(() =>
      reviewDataset(dataset, {
        ...review,
        overrides: [{ ...review.overrides[0], id: 'FY2025:revenue' }],
      }),
    ).toThrow('Sourced');
    expect(() =>
      reviewDataset(dataset, { ...review, overrides: [review.overrides[1], review.overrides[1]] }),
    ).toThrow('Duplicate');
    expect(() =>
      reviewDataset(dataset, { ...review, overrides: [{ ...review.overrides[1], value: -1 }] }),
    ).toThrow('signs');
    dataset.sec!.blockingIssues.push('Transition year');
    expect(() => reviewDataset(dataset, review)).toThrow('comparability');
  });
});

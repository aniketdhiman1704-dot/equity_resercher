import { describe, expect, it } from 'vitest';
import { datasetCsv, parseFinancialCsv } from '../../src/lib/csv';
import { sampleDataset } from '../../src/lib/sample';

function csvWith(
  change: (
    row: (typeof sampleDataset.years)[number],
    index: number,
  ) => (typeof sampleDataset.years)[number],
) {
  return datasetCsv({ ...sampleDataset, years: sampleDataset.years.map(change) });
}

describe('CSV imports', () => {
  it('round-trips synthetic inputs with periods, signs, and units preserved', () => {
    expect(parseFinancialCsv(datasetCsv(sampleDataset))).toEqual(sampleDataset.years);
  });
  it('leaves blank inputs unavailable instead of zero and preserves valid losses', () => {
    const csv = csvWith((row) => ({
      ...row,
      netIncome: -20,
      operatingNwc: -50,
      depreciation: null,
    }));
    const rows = parseFinancialCsv(csv);
    expect(rows[0].depreciation).toBeNull();
    expect(rows[0].netIncome).toBe(-20);
    expect(rows[0].operatingNwc).toBe(-50);
  });
  it('rejects mixed currencies and scales', () => {
    expect(() => parseFinancialCsv(datasetCsv(sampleDataset).replace('USD', 'INR'))).toThrow(/USD/);
    expect(() =>
      parseFinancialCsv(datasetCsv(sampleDataset).replace('millions', 'thousands')),
    ).toThrow(/millions/);
  });
  it('rejects duplicate years, gaps, and quarterly periods', () => {
    const duplicate = {
      ...sampleDataset,
      years: [...sampleDataset.years.slice(1), sampleDataset.years.at(-1)!],
    };
    expect(() => parseFinancialCsv(datasetCsv(duplicate))).toThrow(/unique and consecutive/);
    const gap = { ...sampleDataset, years: sampleDataset.years.filter((_, i) => i !== 3) };
    expect(() => parseFinancialCsv(datasetCsv(gap))).toThrow(/consecutive/);
    expect(() =>
      parseFinancialCsv(
        csvWith((row, i) => (i === 0 ? { ...row, periodStart: '2018-10-01' } : row)),
      ),
    ).toThrow(/full January/);
  });
  it('rejects insufficient history and excessive periods', () => {
    expect(() =>
      parseFinancialCsv(datasetCsv({ ...sampleDataset, years: sampleDataset.years.slice(-2) })),
    ).toThrow(/3–7/);
    expect(() =>
      parseFinancialCsv(
        datasetCsv({ ...sampleDataset, years: [...sampleDataset.years, sampleDataset.years[0]] }),
      ),
    ).toThrow(/maximum/);
  });
  it('rejects missing columns, invalid numbers and negative CapEx', () => {
    expect(() =>
      parseFinancialCsv(datasetCsv(sampleDataset).replace('revenue,', 'sales,')),
    ).toThrow(/Columns/);
    expect(() => parseFinancialCsv(datasetCsv(sampleDataset).replace('5400', 'Infinity'))).toThrow(
      /plain number/,
    );
    expect(() => parseFinancialCsv(csvWith((row) => ({ ...row, capex: -20 })))).toThrow(
      /positive cash outflow/,
    );
  });
  it('checks the balance sheet and fails inconsistent normalization', () => {
    expect(() => parseFinancialCsv(csvWith((row) => ({ ...row, equity: 50 })))).toThrow(
      /reconcile/,
    );
    expect(() =>
      parseFinancialCsv(csvWith((row) => ({ ...row, cash: row.currentAssets! + 1 }))),
    ).toThrow(/cash exceeds/);
  });
  it('rejects an oversized file before attempting extraction', () => {
    expect(() => parseFinancialCsv('x'.repeat(1_000_001))).toThrow(/1 MB/);
  });
});

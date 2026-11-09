import { describe, expect, it } from 'vitest';
import { SecClient } from '../../server/sec-client';
import {
  SecService,
  filingsFromTable,
  groupAnnualFilings,
  normalizeCik,
  parseHistoryYears,
} from '../../server/sec-service';
import {
  archiveUrl,
  cik,
  factsUrl,
  filing,
  fixtureContact,
  fixtureRecords,
  fixtureTransport,
  submissionsUrl,
  table,
} from '../fixtures/sec';

function service(records = fixtureRecords()) {
  return new SecService(
    new SecClient({
      userAgent: fixtureContact,
      transport: fixtureTransport(records),
      intervalMs: 0,
    }),
  );
}

describe('SEC filing discovery', () => {
  it('resolves a ticker and retrieves requested annual periods from archived submissions', async () => {
    const result = await service().companyReports(' msft ', 5);
    expect(result.company.cik).toBe(cik);
    expect(result.periods.map((p) => p.periodEnd)).toEqual([
      '2025-06-30',
      '2024-06-30',
      '2023-06-30',
      '2022-06-30',
      '2021-06-30',
    ]);
    expect(result.submissionSources.map((s) => s.url)).toContain(archiveUrl);
    expect(result.analysisReady).toBe(false);
    expect(result.coverage).toBe('requested-history-found');
    expect(result.periods[0].amendments).toHaveLength(1);
    expect(result.periods[0].annual.documentUrl).toBe(
      'https://www.sec.gov/Archives/edgar/data/789019/000078901925000001/fixture-20250630.htm',
    );
    expect(result.facts.conceptCount).toBe(1);
    expect(result.facts.downloadPath).toContain(result.facts.sha256);
  });
  it('supports numeric CIK and seven distinct annual periods without counting amendments twice', async () => {
    const result = await service().companyReports('CIK789019', 7);
    expect(result.periods).toHaveLength(7);
    expect(result.periods.at(-1)?.periodEnd).toBe('2019-06-30');
  });
  it('reports incomplete history rather than padding or silently dropping the request', async () => {
    const records = fixtureRecords();
    records[archiveUrl] = table([]);
    const result = await service(records).companyReports(cik, 5);
    expect(result.coverage).toBe('partial-history');
    expect(result.periods).toHaveLength(2);
    expect(result.warnings.some((w) => w.includes('Fewer than three'))).toBe(true);
  });
  it('rejects mismatched issuer identities', async () => {
    const records = fixtureRecords();
    records[factsUrl] = { cik: 1, entityName: 'Wrong issuer', facts: {} };
    await expect(service(records).companyReports(cik, 3)).rejects.toMatchObject({
      code: 'SEC_IDENTITY_MISMATCH',
    });
  });
  it('rejects invalid history, identifiers, and URL injection', async () => {
    for (const years of ['2', '8', '3.5', '', '5oops'])
      expect(() => parseHistoryYears(years)).toThrow();
    expect(parseHistoryYears(null)).toBe(5);
    expect(normalizeCik('CIK789019')).toBe(cik);
    await expect(service().companyReports('https://evil.test', 5)).rejects.toMatchObject({
      code: 'INVALID_IDENTIFIER',
    });
    expect(() =>
      filingsFromTable(table([{ ...filing(2025), primaryDocument: '../../evil.html' }]), cik),
    ).toThrow();
    expect(() =>
      filingsFromTable(table([{ ...filing(2025), reportDate: '2025-02-30' }]), cik),
    ).toThrow();
    const records = fixtureRecords();
    const company = records[submissionsUrl] as { filings: { files: { name: string }[] } };
    company.filings.files[0].name = 'https://evil.test/data';
    await expect(service(records).companyReports(cik, 5)).rejects.toMatchObject({
      code: 'SEC_INVALID_ARCHIVE',
    });
  });
  it('detects schema changes and ambiguous originals instead of guessing', () => {
    const invalid = { ...table([filing(2025)]), primaryDocument: [] };
    expect(() => filingsFromTable(invalid, cik)).toThrow(/inconsistent/);
    const list = filingsFromTable(table([filing(2025), filing(2025, '10-K', '000004')]), cik);
    expect(() => groupAnnualFilings(list, 3)).toThrow(/Multiple original/);
    const single = filingsFromTable(table([filing(2025)]), cik);
    expect(groupAnnualFilings([...single, ...single], 3)).toHaveLength(1);
  });
  it('does not count an amendment or quarter as a new annual report', () => {
    const list = filingsFromTable(table([filing(2025, '10-Q'), filing(2024, '10-K/A')]), cik);
    expect(groupAnnualFilings(list, 3)).toEqual([]);
  });
});

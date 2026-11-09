import { describe, expect, it } from 'vitest';
import { parseSession, serializeSession, MAX_SESSION_BYTES } from '../../src/lib/session';
import { sampleAssumptions, sampleDataset } from '../../src/lib/sample';
import { tryValue, scenarioAssumptions } from '../../src/lib/finance';
import { normalizedFixture } from '../fixtures/financials';
import { reviewDataset } from '../../server/normalize';

const saved = () =>
  serializeSession(sampleDataset, { ...sampleAssumptions, wacc: 0.12 }, 7, 'Bear');
describe('portable research sessions', () => {
  it('round-trips inputs, selected history and scenario and reproduces a recomputed valuation', () => {
    const restored = parseSession(saved());
    expect(restored.dataset).toEqual(sampleDataset);
    expect(restored.historyLength).toBe(7);
    expect(restored.scenario).toBe('Bear');
    expect(
      tryValue(
        restored.dataset.years.at(-1)!,
        scenarioAssumptions(restored.assumptions, restored.scenario),
      ),
    ).toEqual(
      tryValue(
        sampleDataset.years.at(-1)!,
        scenarioAssumptions({ ...sampleAssumptions, wacc: 0.12 }, 'Bear'),
      ),
    );
    expect(JSON.parse(saved())).not.toHaveProperty('valuation');
    expect(JSON.parse(saved())).not.toHaveProperty('researchRun');
  });
  it('keeps missing inputs distinct from zero and retains the private source fingerprint', () => {
    const data = structuredClone(sampleDataset);
    data.kind = 'upload';
    data.company = 'Private fixture';
    data.sourceHash = 'a'.repeat(64);
    data.years.at(-1)!.depreciation = null;
    data.years.at(-1)!.shortTermInvestments = 0;
    const restored = parseSession(
      serializeSession(data, { ...sampleAssumptions, daRate: NaN, shares: null }, 3, 'Bull'),
    );
    expect(restored.dataset.sourceHash).toBe(data.sourceHash);
    expect(restored.dataset.years.at(-1)!.depreciation).toBeNull();
    expect(restored.dataset.years.at(-1)!.shortTermInvestments).toBe(0);
    expect(Number.isNaN(restored.assumptions.daRate)).toBe(true);
    expect(restored.assumptions.shares).toBeNull();
    expect(tryValue(restored.dataset.years.at(-1)!, restored.assumptions).value).toBeNull();
  });
  it('rejects unknown formats/versions, derived output injection and oversized files', () => {
    expect(() => parseSession('{broken')).toThrow('valid JSON');
    expect(() => parseSession(JSON.stringify({ data: sampleDataset, valuation: 1e9 }))).toThrow(
      'research-report',
    );
    for (const patch of [
      { version: 2 },
      { calculationVersion: 'future-version' },
      { valuation: 1e9 },
      { approved: true },
      { researchRun: { fake: true } },
    ])
      expect(() => parseSession(JSON.stringify({ ...JSON.parse(saved()), ...patch }))).toThrow(
        'supported session',
      );
    expect(() => parseSession(' '.repeat(MAX_SESSION_BYTES + 1))).toThrow('5 MB');
  });
  it('rejects modified demo identity and facts, unsupported units and broken annual series', () => {
    for (const alter of [
      (s: any) => {
        s.data.company = 'Pretend public issuer';
      },
      (s: any) => {
        s.data.years[0].revenue += 1;
      },
      (s: any) => {
        s.data.years[0].currency = 'EUR';
      },
      (s: any) => {
        s.data.kind = 'upload';
        s.data.years[0].capex = -1;
      },
      (s: any) => {
        s.data.kind = 'upload';
        s.data.years.reverse();
      },
      (s: any) => {
        s.data.years[0].periodStart = '2018-02-30';
      },
      (s: any) => {
        s.data.years[0].revenue = '1000';
      },
      (s: any) => {
        s.data.years = s.data.years.slice(-3);
        s.historyLength = 7;
      },
    ]) {
      const s = JSON.parse(saved());
      alter(s);
      expect(() => parseSession(JSON.stringify(s))).toThrow();
    }
  });
  it('does not restore non-sample capitalization or invent missing assumption fields', () => {
    const s = JSON.parse(saved());
    s.data.kind = 'upload';
    expect(() => parseSession(JSON.stringify(s))).toThrow('capitalization');
    s.assumptions.shares = null;
    delete s.assumptions.wacc;
    expect(() => parseSession(JSON.stringify(s))).toThrow('supported session');
  });
  it('preserves public evidence and manual notes while requiring source refresh on every reopen', async () => {
    const { dataset } = await normalizedFixture();
    const reviewed = reviewDataset(dataset, {
      confirmed: true,
      notes: 'Synthetic statement scope checked.',
      overrides: [
        {
          id: 'FY2025:debt',
          value: 300,
          reason: 'Synthetic current and non-current borrowing schedule.',
        },
      ],
    });
    const text = serializeSession(reviewed, { ...sampleAssumptions, shares: null }, 5, 'Base');
    const restored = parseSession(text);
    expect(restored.dataset.restoredAt).toBeTruthy();
    expect(restored.dataset.sec!.evidence).toEqual(reviewed.sec!.evidence);
    expect(restored.dataset.sec!.review!.overrides[0].value).toBe(300);
    const resaved = serializeSession(restored.dataset, restored.assumptions, 5, 'Base');
    expect(JSON.parse(resaved).data).not.toHaveProperty('restoredAt');
    expect(parseSession(resaved).dataset.restoredAt).toBeTruthy();
    for (const alter of [
      (s: any) => {
        s.data.sec.evidence['FY2025:revenue'].selected.url = 'javascript:alert(1)';
      },
      (s: any) => {
        s.data.sec.sourceUrl = 'https://evil.test/facts';
      },
      (s: any) => {
        s.data.years[4].revenue = 1e8;
      },
      (s: any) => {
        s.data.sec.evidence['FY2025:revenue'].candidates = [];
      },
      (s: any) => {
        s.data.sec.evidence['FY2025:debt'].reason = 'Fabricated rationale';
      },
      (s: any) => {
        s.data.sec.blockingIssues = ['Transition year'];
      },
    ]) {
      const s = JSON.parse(text);
      alter(s);
      expect(() => parseSession(JSON.stringify(s))).toThrow();
    }
  });
});

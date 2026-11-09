import { describe, expect, it } from 'vitest';
import {
  bridgeToEquity,
  cagr,
  fcff,
  ratios,
  scenarioAssumptions,
  tryValue,
  valueCompany,
} from '../../src/lib/finance';
import { sampleAssumptions, sampleDataset } from '../../src/lib/sample';
import type { Assumptions, FinancialYear } from '../../src/lib/types';

const latest = sampleDataset.years.at(-1)!;
const previous = sampleDataset.years.at(-2)!;
const get = (id: string, row: FinancialYear = latest, opening?: FinancialYear) =>
  ratios(row, opening).find((m) => m.id === id)!;

describe('financial ratios and evidence', () => {
  it('calculates the documented FCFF and equity-bridge examples', () => {
    expect(fcff(100, 0.25, 10, 20, 5)).toBe(60);
    expect(
      bridgeToEquity(1000, { excessCash: 50, nonOperatingAssets: 0, debt: 200, otherClaims: 0 }),
    ).toBe(850);
  });
  it('counts intervals rather than observations for CAGR', () => {
    expect(cagr(100, 121, 2)).toBeCloseTo(0.1, 12);
    expect(cagr(0, 121, 2)).toBeNull();
    expect(cagr(-100, 121, 2)).toBeNull();
    expect(cagr(100, -121, 2)).toBeNull();
    expect(cagr(100, 121, 0)).toBeNull();
  });
  it('uses average opening and closing common equity, not just closing equity', () => {
    const row = { ...latest, netIncome: 30, equity: 200 };
    const opening = { ...previous, equity: 100 };
    const metric = get('roe', row, opening);
    expect(metric.value).toBeCloseTo(0.2, 12);
    expect(metric.inputs).toEqual(['FY2025:netIncome', 'FY2025:equity', 'FY2024:equity']);
    expect(metric.reason).toBeUndefined();
  });
  it('withholds average-balance ratios without valid consecutive opening balances', () => {
    expect(get('roe').value).toBeNull();
    expect(get('roe', latest, { ...previous, fiscalYear: 2023 }).value).toBeNull();
    expect(get('roe', latest, { ...previous, equity: -10 }).value).toBeNull();
    expect(get('roe', { ...latest, equity: -10 }, previous).value).toBeNull();
  });
  it('keeps missing and zero values distinct', () => {
    expect(get('netMargin', { ...latest, netIncome: 0 }).value).toBe(0);
    expect(get('netMargin', { ...latest, netIncome: null }).value).toBeNull();
    expect(get('netMargin', { ...latest, revenue: 0 }).value).toBeNull();
    expect(get('quickRatio', { ...latest, cash: null }).value).toBeNull();
    expect(get('cashAfterCapex', { ...latest, capex: null }).value).toBeNull();
  });
  it('uses debt rather than total liabilities and handles net cash', () => {
    const row = {
      ...latest,
      debt: 50,
      totalLiabilities: 900,
      equity: 100,
      cash: 100,
      shortTermInvestments: 0,
      ebit: 30,
      depreciation: 20,
    };
    expect(get('debtEquity', row).value).toBe(0.5);
    expect(get('netDebtEbitda', row).value).toBe(-1);
    expect(get('netDebtEbitda', { ...row, ebit: -20 }).value).toBeNull();
    expect(get('interestCoverage', { ...row, interestExpense: 0 }).value).toBeNull();
  });
  it('records valid source references for all ratio inputs', () => {
    for (const metric of ratios(latest, previous)) {
      expect(metric.formula.length).toBeGreaterThan(5);
      for (const ref of metric.inputs) {
        const [year, field] = ref.split(':');
        const row = sampleDataset.years.find((y) => y.fiscalYear === Number(year.slice(2)));
        expect(row).toBeDefined();
        expect(row).toHaveProperty(field);
      }
    }
  });
});

describe('DCF valuation', () => {
  it('matches a flat perpetuity with an independent known value', () => {
    const row = { ...latest, revenue: 1000, ebit: 100, operatingNwc: 0, cash: 100 };
    const a: Assumptions = {
      growth: 0,
      margin: 0.1,
      taxRate: 0,
      daRate: 0,
      capexRate: 0,
      nwcRate: 0,
      wacc: 0.1,
      terminalGrowth: 0,
      excessCash: 50,
      debt: 200,
      nonOperatingAssets: 0,
      otherClaims: 0,
      shares: 100,
    };
    const result = valueCompany(row, a);
    expect(result.forecast).toHaveLength(5);
    expect(result.enterpriseValue).toBeCloseTo(1000, 9);
    expect(result.equityValue).toBeCloseTo(850, 9);
    expect(result.perShare).toBeCloseTo(8.5, 9);
    expect(result.terminal.year).toBe(2031);
  });
  it('projects year-six operating drivers rather than growing year-five FCFF mechanically', () => {
    const r = valueCompany(latest, sampleAssumptions);
    expect(r.terminal.revenue).toBeCloseTo(r.forecast[4].revenue * 1.025, 8);
    expect(r.terminal.deltaNwc).toBeCloseTo((r.terminal.revenue - r.forecast[4].revenue) * 0.12, 8);
    expect(r.terminal.fcff).not.toBeCloseTo(r.forecast[4].fcff * 1.025, 2);
    expect(r.terminalValue).toBeCloseTo(r.terminal.fcff / 0.075, 8);
  });
  it('responds economically to discount rates, investment, working capital, and financing', () => {
    const base = valueCompany(latest, sampleAssumptions);
    const capex = valueCompany(latest, { ...sampleAssumptions, capexRate: 0.06 });
    expect(capex.forecast[0].fcff).toBeLessThan(base.forecast[0].fcff);
    expect(capex.enterpriseValue).toBeLessThan(base.enterpriseValue);
    expect(valueCompany(latest, { ...sampleAssumptions, wacc: 0.12 }).enterpriseValue).toBeLessThan(
      base.enterpriseValue,
    );
    expect(
      valueCompany(latest, { ...sampleAssumptions, nwcRate: 0.2 }).forecast[0].fcff,
    ).toBeLessThan(base.forecast[0].fcff);
    const moreDebt = valueCompany(latest, {
      ...sampleAssumptions,
      debt: sampleAssumptions.debt + 100,
    });
    expect(moreDebt.enterpriseValue).toBe(base.enterpriseValue);
    expect(moreDebt.equityValue).toBeCloseTo(base.equityValue - 100, 10);
  });
  it.each([0.025, 0.02, 0, -0.1])('rejects invalid WACC %s without a stale output', (wacc) => {
    const result = tryValue(latest, { ...sampleAssumptions, wacc });
    expect(result.value).toBeNull();
    expect(result.error).toMatch(/WACC/);
  });
  it('rejects missing baseline inputs, negative EBIT, and non-finite assumptions', () => {
    expect(() => valueCompany({ ...latest, operatingNwc: null }, sampleAssumptions)).toThrow(
      /working capital/,
    );
    expect(() => valueCompany({ ...latest, ebit: -1 }, sampleAssumptions)).toThrow(/profitable/);
    expect(() => valueCompany(latest, { ...sampleAssumptions, growth: NaN })).toThrow(/finite/);
    expect(() =>
      valueCompany(latest, { ...sampleAssumptions, excessCash: latest.cash! + 1 }),
    ).toThrow(/cash/);
  });
  it('requires reinvestment for positive terminal growth and sensible shares', () => {
    expect(() =>
      valueCompany(latest, { ...sampleAssumptions, capexRate: 0, daRate: 0.035, nwcRate: 0 }),
    ).toThrow(/reinvestment/);
    expect(() => valueCompany(latest, { ...sampleAssumptions, shares: 0 })).toThrow(/shares/);
    expect(valueCompany(latest, { ...sampleAssumptions, shares: null }).perShare).toBeNull();
  });
  it('does not report a negative per-share equity price', () => {
    const result = valueCompany(latest, { ...sampleAssumptions, debt: 1e9 });
    expect(result.equityValue).toBeLessThan(0);
    expect(result.perShare).toBeNull();
  });
  it('keeps scenario changes explicit, bounded to operating drivers, and immutable', () => {
    const snapshot = { ...sampleAssumptions };
    const bull = scenarioAssumptions(sampleAssumptions, 'Bull');
    expect(bull.growth).toBeCloseTo(0.1);
    expect(bull.margin).toBeCloseTo(0.25);
    expect(bull.wacc).toBe(snapshot.wacc);
    expect(bull.terminalGrowth).toBe(snapshot.terminalGrowth);
    expect(sampleAssumptions).toEqual(snapshot);
    expect(valueCompany(latest, bull).enterpriseValue).toBeGreaterThan(
      valueCompany(latest, snapshot).enterpriseValue,
    );
  });
});

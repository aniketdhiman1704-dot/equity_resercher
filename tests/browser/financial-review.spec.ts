import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { normalizedFixture } from '../fixtures/financials';
import { research } from '../../server/research-service';

test('historical research, explicit DCF scope, manual revisions and exports stay consistent', async ({
  page,
}) => {
  const { dataset, reports, service } = await normalizedFixture(undefined, 3);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/sec/company?*', (r) => r.fulfill({ json: reports }));
  await page.route('**/api/sec/normalized?*', (r) => r.fulfill({ json: dataset }));
  await page.route('**/api/research', async (r) => {
    const result = await research(service, r.request().postDataJSON());
    await r.fulfill({ json: result });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'SEC filings', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Find filings' }).click();
  await dialog.getByRole('button', { name: 'Review financial history' }).click();
  await dialog
    .getByLabel('Source review note')
    .fill('Checked fixture source periods, units and supported financial facts.');
  await dialog.getByRole('checkbox', { name: /I checked the historical periods/ }).check();
  await dialog.getByRole('button', { name: 'Load reviewed financials' }).click();
  await page.getByRole('button', { name: 'Research agents', exact: true }).click();
  await page.getByRole('button', { name: 'Run research' }).click();
  await expect(page.locator('.agent-card')).toHaveCount(3);
  await expect(page.locator('.agent-card').last()).toContainText('Review DCF suitability');
  await page.getByRole('navigation').getByRole('button', { name: 'DCF valuation' }).click();
  await expect(page.getByTestId('valuation-result')).toHaveText('—');
  await expect(page.getByRole('button', { name: 'Apply reviewed assumptions' })).toBeDisabled();
  await page.getByRole('button', { name: 'Review mappings' }).click();
  dialog = page.getByRole('dialog');
  await dialog.locator('summary').filter({ hasText: 'FY 2025' }).click();
  await dialog.getByLabel('FY2025:operatingNwc manual value').fill('100');
  await dialog
    .getByLabel('FY2025:operatingNwc source note')
    .fill('Fixture: operating assets less payables/accruals, excluding financing, cash and tax.');
  await dialog.getByLabel('FY2025:debt manual value').fill('300');
  await dialog
    .getByLabel('FY2025:debt source note')
    .fill('Fixture borrowing note: 50 current plus 250 non-current, no leases.');
  await dialog.getByRole('checkbox', { name: /I checked the historical periods/ }).check();
  await dialog.getByRole('checkbox', { name: /I also reviewed DCF suitability/ }).check();
  await expect(dialog.getByRole('button', { name: 'Load reviewed financials' })).toBeDisabled();
  await dialog
    .getByLabel('Valuation scope note')
    .fill(
      'Synthetic issuer has no leases, preferred equity or NCI; operating accounts and borrowing reconciled.',
    );
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(accessibility.violations.map((v) => v.id)).toEqual([]);
  await dialog.getByRole('button', { name: 'Load reviewed financials' }).click();
  await expect(
    page.getByRole('spinbutton', { name: 'Interest-bearing debt', exact: true }),
  ).toHaveValue('300');
  await expect(page.getByRole('button', { name: 'Apply reviewed assumptions' })).toBeDisabled();
  await page
    .getByLabel('Assumption rationale')
    .fill(
      'Fixture only: flat historical growth, 20% margin, 25% tax, 10% WACC and 2.5% terminal growth; reviewed reinvestment and claims.',
    );
  await page.getByRole('button', { name: 'Apply reviewed assumptions' }).click();
  await expect(page.getByTestId('valuation-result')).not.toHaveText('—');
  await page.getByRole('button', { name: 'Research agents', exact: true }).click();
  await page.getByRole('button', { name: 'Run research' }).click();
  await expect(page.getByText('Base enterprise value', { exact: true })).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export report', exact: true }).click();
  const report = JSON.parse(await readFile((await (await downloaded).path())!, 'utf8'));
  expect(
    report.researchRun.agents[2].evidence.find((e: { id: string }) => e.id === 'dcf:Base').value,
  ).toBe(report.valuation.enterpriseValue);
  expect(report.valuation.equityValue).toBeCloseTo(report.valuation.enterpriseValue - 300, 8);
  expect(report.valuation.perShare).toBeNull();
  expect(report.assumptionNotes).toContain('10% WACC');
  expect(report.valuationAsOf).toBe('2025-06-30');
  // Clearing a prior manual input must invalidate all downstream results.
  await page.getByRole('button', { name: 'Review mappings' }).click();
  dialog = page.getByRole('dialog');
  await dialog.locator('summary').filter({ hasText: 'FY 2025' }).click();
  await dialog.getByLabel('FY2025:debt manual value').fill('');
  await dialog.getByRole('checkbox', { name: /I checked the historical periods/ }).check();
  await dialog.getByRole('button', { name: 'Load reviewed financials' }).click();
  await expect(page.locator('.agent-card')).toHaveCount(0);
  await page.getByRole('navigation').getByRole('button', { name: 'DCF valuation' }).click();
  await expect(page.getByTestId('valuation-result')).toHaveText('—');
  await expect(
    page.getByRole('spinbutton', { name: 'Interest-bearing debt', exact: true }),
  ).toHaveValue('');
  expect(errors).toEqual([]);
});

import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { normalizedFixture } from '../fixtures/financials';
import { datasetCsv } from '../../src/lib/csv';
import { sampleDataset } from '../../src/lib/sample';

test('three local workers export computed evidence and invalidate on edits', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Research agents', exact: true }).click();
  await page.getByRole('button', { name: 'Run research' }).click();
  await expect(page.locator('.agent-card')).toHaveCount(3);
  await expect(page.getByText('Base enterprise value', { exact: true })).toBeVisible();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export report', exact: true }).click();
  const download = await pending;
  const report = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(report.researchRun.agents).toHaveLength(3);
  expect(report.researchRun.inputHash).toMatch(/^[a-f0-9]{64}$/);
  expect(
    report.researchRun.agents[2].evidence.find((e: { id: string }) => e.id === 'dcf:Base').value,
  ).toBe(report.valuation.enterpriseValue);
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(accessibility.violations.map((v) => v.id)).toEqual([]);
  await page.getByRole('navigation').getByRole('button', { name: 'DCF valuation' }).click();
  await page.getByRole('spinbutton', { name: 'WACC', exact: true }).fill('12');
  await page.getByRole('button', { name: 'Research agents', exact: true }).click();
  await expect(page.locator('.agent-card')).toHaveCount(0);
  await expect(page.getByText('No research run yet.', { exact: false })).toBeVisible();
  expect(errors).toEqual([]);
});

test('SEC mapping requires review, shows filing provenance, and loads missing inputs honestly', async ({
  page,
}) => {
  const { dataset, reports } = await normalizedFixture(undefined, 3);
  await page.route('**/api/sec/company?*', (r) => r.fulfill({ json: reports }));
  await page.route('**/api/sec/normalized?*', (r) => r.fulfill({ json: dataset }));
  await page.goto('/');
  await page.getByRole('button', { name: 'SEC filings', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Find filings', exact: true }).click();
  await dialog.getByRole('button', { name: 'Review financial history', exact: true }).click();
  const accept = dialog.getByRole('button', { name: 'Load reviewed financials' });
  await expect(accept).toBeDisabled();
  await dialog.getByText('FY 2025 · 2024-07-01 → 2025-06-30', { exact: true }).click();
  await dialog.getByLabel('FY2025:operatingNwc manual value').fill('120');
  await dialog
    .getByLabel('FY2025:operatingNwc source note')
    .fill('Synthetic operating balances reviewed in fixture statement.');
  await dialog.getByLabel('FY2025:debt manual value').fill('300');
  await dialog
    .getByLabel('FY2025:debt source note')
    .fill('Synthetic borrowing schedule: current plus non-current debt.');
  await dialog
    .getByLabel('Source review note')
    .fill('Checked fiscal dates, units and selected annual source tags.');
  await dialog.getByRole('checkbox', { name: /I checked the historical periods/ }).check();
  await expect(accept).toBeEnabled();
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(accessibility.violations.map((v) => v.id)).toEqual([]);
  await accept.click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Fixture Software (synthetic)', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Public company workspace', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Inspect operating margin' }).click();
  await expect(page.getByRole('dialog').getByText('20.0%', { exact: true })).toBeVisible();
  await page.getByRole('dialog').locator('.fact-evidence summary').first().click();
  await expect(
    page.getByRole('dialog').getByRole('link', { name: /OperatingIncomeLoss/ }),
  ).toHaveAttribute('href', /sec.gov\/Archives/);
  await page.keyboard.press('Escape');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export report', exact: true }).click();
  const report = JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
  expect(report.data.kind).toBe('sec');
  expect(report.data.sec.evidence['FY2025:debt'].status).toBe('user-entered');
  expect(report.valuation).toBeNull();
});

test('mobile research works and private research runs entirely in the browser', async ({
  page,
}) => {
  const posts: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST') posts.push(request.url());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Research agents', exact: true }).click();
  await page.getByRole('button', { name: 'Run research' }).click();
  await expect(page.locator('.agent-card')).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page
    .locator('#main-content')
    .getByRole('button', { name: 'Import financials', exact: true })
    .click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'private.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(datasetCsv({ ...sampleDataset, years: sampleDataset.years.slice(-3) })),
  });
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Use financials' }).click();
  await page.getByRole('button', { name: 'Research agents', exact: true }).click();
  await expect(
    page.getByText('Research runs entirely in this browser.', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Run research' }).click();
  await expect(page.locator('.agent-card')).toHaveCount(3);
  await expect(page.getByText('Valuation withheld', { exact: true })).toBeVisible();
  expect(posts).toEqual([]);
});

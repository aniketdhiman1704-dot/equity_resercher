import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { sampleDataset } from '../../src/lib/sample';
import { datasetCsv } from '../../src/lib/csv';

test('overview renders real charts and source-backed ratios', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Northstar Systems' })).toBeVisible();
  await expect(
    page.getByText('Explore with synthetic financials. No live market data.'),
  ).toBeVisible();
  await expect(page.locator('.recharts-bar-rectangle')).toHaveCount(10);
  const tallestBar = await page
    .locator('.recharts-bar-rectangle')
    .evaluateAll((elements) => Math.max(...elements.map((e) => e.getBoundingClientRect().height)));
  expect(tallestBar).toBeGreaterThan(100);
  await page.getByRole('button', { name: 'Inspect operating margin' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('22.0%', { exact: true })).toBeVisible();
  await expect(dialog.getByText('FY2025:ebit', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Cash flow', exact: true }).click();
  await expect(
    page.getByRole('img', { name: /Operating cash flow and cash flow after CapEx/ }),
  ).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('history selection and statement/ratio tables remain aligned', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Historical period').selectOption('7');
  await page.getByRole('navigation').getByRole('button', { name: 'Financial statements' }).click();
  await expect(page.getByRole('columnheader', { name: 'FY 2019', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'FY 2018', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Financial ratios', exact: true }).click();
  await page.getByRole('button', { name: 'Return on equity', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('FY2024:equity', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('navigation').getByRole('button', { name: 'Sources & evidence' }).click();
  await expect(page.locator('.source-row')).toHaveCount(7);
  await expect(page.getByRole('heading', { name: 'Three research agents' })).toBeVisible();
});

test('DCF recomputes, changes scenarios, and removes invalid results', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'DCF valuation' }).click();
  const result = page.getByTestId('valuation-result');
  const base = await result.textContent();
  await page.getByRole('button', { name: 'Bull case' }).click();
  await expect(result).not.toHaveText(base!);
  await page.getByRole('button', { name: 'Base case' }).click();
  await expect(result).toHaveText(base!);
  await page.getByRole('spinbutton', { name: 'WACC', exact: true }).fill('2');
  await expect(page.getByRole('alert')).toContainText(
    'WACC must be positive and greater than terminal growth',
  );
  await expect(result).toHaveText('—');
  await expect(page.getByRole('heading', { name: 'Inside the forecast' })).toHaveCount(0);
  await page.getByRole('spinbutton', { name: 'WACC', exact: true }).fill('12');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(result).not.toHaveText(base!);
  await expect(page.getByRole('heading', { name: 'Inside the forecast' })).toBeVisible();
  await page.getByRole('button', { name: 'Reset assumptions', exact: true }).click();
  await expect(result).toHaveText(base!);
});

test('CSV import validates first, stays local, and requires assumption review', async ({
  page,
}) => {
  const outgoingPosts: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST') outgoingPosts.push(r.url());
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Import financials', exact: true }).last().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Financial CSV file').setInputFiles({
    name: 'bad.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('wrong,headers\n1,2'),
  });
  await expect(dialog.getByRole('alert')).toContainText('Columns must match the template');
  await expect(dialog.getByRole('button', { name: 'Use financials' })).toBeDisabled();
  await dialog.getByLabel('Financial CSV file').setInputFiles({
    name: 'private-company.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(datasetCsv(sampleDataset)),
  });
  await expect(dialog.getByText('8 consecutive years parsed')).toBeVisible();
  await dialog.getByLabel('Company name').fill('Acme Private Holdings');
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Use financials' }).click();
  await expect(page.getByRole('heading', { name: 'Acme Private Holdings' })).toBeVisible();
  await expect(page.getByTestId('overview-valuation')).toHaveText('—');
  await page.getByRole('navigation').getByRole('button', { name: 'DCF valuation' }).click();
  await page
    .getByLabel('Assumption rationale')
    .fill(
      'Teaching fixture assumptions: reviewed growth, reinvestment, WACC and claims; not a real price target.',
    );
  await page.getByRole('button', { name: 'Apply reviewed assumptions' }).click();
  await expect(page.getByTestId('valuation-result')).not.toHaveText('—');
  await page.getByRole('spinbutton', { name: 'Revenue growth', exact: true }).fill('7');
  await expect(page.getByTestId('valuation-result')).toHaveText('—');
  await page
    .getByLabel('Assumption rationale')
    .fill(
      'Teaching fixture assumptions: reviewed growth, reinvestment, WACC and claims; not a real price target.',
    );
  await page.getByRole('button', { name: 'Apply reviewed assumptions' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export report', exact: true }).click();
  const download = await downloadPromise;
  const report = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(report.data.company).toBe('Acme Private Holdings');
  expect(report.data.sourceHash).toMatch(/^[0-9a-f]{64}$/);
  expect(report.appliedAssumptions.growth).toBe(0.07);
  expect(report.valuation.perShare).toBeNull();
  expect(report.valuation.forecast).toHaveLength(5);
  expect(outgoingPosts).toEqual([]);
});

test('mobile navigation, dialogs and layout work at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'DCF valuation' }).click();
  await expect(page.getByRole('heading', { name: 'DCF valuation', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'About the methodology' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('overview meets automated WCAG A/AA checks', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(
    results.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
});

import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { sampleAssumptions, sampleDataset } from '../../src/lib/sample';
import { serializeSession } from '../../src/lib/session';
import { normalizedFixture } from '../fixtures/financials';
import { reviewDataset } from '../../server/normalize';

test('save, reload and open restores the edited workspace without restoring old agent output', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Historical period').selectOption('7');
  await page.getByRole('navigation').getByRole('button', { name: 'DCF valuation' }).click();
  await page.getByRole('spinbutton', { name: 'WACC', exact: true }).fill('12');
  await page.getByRole('button', { name: 'Bull case' }).click();
  const value = await page.getByTestId('valuation-result').textContent();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save session', exact: true }).click();
  const download = await downloading;
  const path = (await download.path())!;
  const saved = JSON.parse(await readFile(path, 'utf8'));
  expect(saved.assumptions.wacc).toBe(0.12);
  expect(saved.historyLength).toBe(7);
  expect(saved.scenario).toBe('Bull');
  await page.reload();
  await page.getByRole('button', { name: 'Open session', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Saved session file').setInputFiles(path);
  await expect(dialog.getByRole('button', { name: 'Open session', exact: true })).toBeDisabled();
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(accessibility.violations.map((v) => v.id)).toEqual([]);
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Open session', exact: true }).click();
  await expect(page.getByLabel('Historical period')).toHaveValue('7');
  await page.getByRole('navigation').getByRole('button', { name: 'DCF valuation' }).click();
  await expect(page.getByRole('spinbutton', { name: 'WACC', exact: true })).toHaveValue('12');
  await expect(page.getByTestId('valuation-result')).toHaveText(value!);
  await page.getByRole('button', { name: 'Research agents', exact: true }).click();
  await expect(page.locator('.agent-card')).toHaveCount(0);
});

test('private session stays local, requires DCF reapproval and invalid files leave the workspace intact', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const posts: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST') posts.push(r.url());
  });
  const data = {
    ...sampleDataset,
    kind: 'upload' as const,
    company: 'Saved private company',
    sourceHash: 'a'.repeat(64),
  };
  const saved = serializeSession(
    data,
    { ...sampleAssumptions, shares: null, wacc: 0.12 },
    3,
    'Base',
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Open session', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Saved session file')
    .setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  await expect(dialog.getByRole('alert')).toContainText('not a supported session');
  await expect(dialog.getByRole('button', { name: 'Open session', exact: true })).toBeDisabled();
  await dialog.getByLabel('Saved session file').setInputFiles({
    name: 'private.equity.json',
    mimeType: 'application/json',
    buffer: Buffer.from(saved),
  });
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Open session', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Saved private company', exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('overview-valuation')).toHaveText('—');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'DCF valuation' }).click();
  await page
    .getByLabel('Assumption rationale')
    .fill(
      'Teaching fixture assumptions: reviewed growth, reinvestment, WACC and claims; not a real price target.',
    );
  await page.getByRole('button', { name: 'Apply reviewed assumptions' }).click();
  await expect(page.getByTestId('valuation-result')).not.toHaveText('—');
  expect(posts).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('SEC snapshot requires refreshed source review and retains saved assumptions when refreshed', async ({
  page,
}) => {
  const { dataset, reports } = await normalizedFixture();
  const reviewed = reviewDataset(dataset, {
    confirmed: true,
    notes: 'Checked synthetic source statements.',
    overrides: [],
  });
  const saved = serializeSession(
    reviewed,
    { ...sampleAssumptions, shares: null, wacc: 0.13 },
    5,
    'Bear',
  );
  await page.route('**/api/sec/company?*', (r) => r.fulfill({ json: reports }));
  await page.route('**/api/sec/normalized?*', (r) => r.fulfill({ json: dataset }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Open session', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Saved session file').setInputFiles({
    name: 'public.equity.json',
    mimeType: 'application/json',
    buffer: Buffer.from(saved),
  });
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Open session', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'DCF valuation' }).click();
  await expect(page.getByRole('button', { name: 'Apply reviewed assumptions' })).toBeDisabled();
  await page.getByRole('button', { name: 'Research agents', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Run research' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Refresh SEC source', exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Ticker or CIK')).toHaveValue(dataset.sec!.cik);
  await dialog.getByRole('button', { name: 'Find filings', exact: true }).click();
  await dialog.getByRole('button', { name: 'Review financial history' }).click();
  await dialog
    .getByLabel('Source review note')
    .fill('Reviewed refreshed fixture periods, tags and scope.');
  await dialog.getByRole('checkbox', { name: /I checked the historical periods/ }).check();
  await dialog.getByRole('button', { name: 'Load reviewed financials' }).click();
  await expect(page.getByRole('button', { name: 'Refresh SEC source', exact: true })).toHaveCount(
    0,
  );
  await page.getByRole('navigation').getByRole('button', { name: 'DCF valuation' }).click();
  await expect(page.getByRole('spinbutton', { name: 'WACC', exact: true })).toHaveValue('13');
  await page.getByRole('button', { name: 'Research agents', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Run research' })).toBeEnabled();
});

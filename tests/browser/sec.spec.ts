import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { SecClient } from '../../server/sec-client';
import { SecService } from '../../server/sec-service';
import { factsUrl, fixtureContact, fixtureRecords, fixtureTransport } from '../fixtures/sec';

test('SEC discovery shows source filings and downloads raw facts without changing the analysis', async ({
  page,
}) => {
  const records = fixtureRecords();
  const service = new SecService(
    new SecClient({
      userAgent: fixtureContact,
      transport: fixtureTransport(records),
      intervalMs: 0,
    }),
  );
  await page.route('**/api/sec/company?*', async (route) => {
    const url = new URL(route.request().url());
    const data = await service.companyReports(
      url.searchParams.get('identifier')!,
      Number(url.searchParams.get('years')),
    );
    await route.fulfill({ status: 200, json: data });
  });
  await page.route('**/api/sec/facts?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(records[factsUrl]),
    }),
  );
  await page.goto('/');
  const before = await page.getByTestId('overview-valuation').textContent();
  await page.getByRole('button', { name: 'SEC filings', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('SEC annual periods').selectOption('7');
  await dialog.getByRole('button', { name: 'Find filings', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Fixture Software (synthetic)' })).toBeVisible();
  await expect(dialog.locator('.sec-filing')).toHaveCount(7);
  await expect(
    dialog.getByText('Filing discovery complete; financial mapping pending.'),
  ).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Read annual report' }).first()).toHaveAttribute(
    'href',
    'https://www.sec.gov/Archives/edgar/data/789019/000078901925000001/fixture-20250630.htm',
  );
  await expect(dialog.getByRole('link', { name: /10-K\/A amendment/ })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download raw facts' }).click();
  const download = await downloadPromise;
  const data = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(data.facts['us-gaap'].Revenues.units.USD[0].val).toBe(123_000_000);
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(
    accessibility.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByRole('heading', { name: 'Northstar Systems' })).toBeVisible();
  await expect(page.getByTestId('overview-valuation')).toHaveText(before!);
});

test('SEC errors are visible and mobile lookup does not overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/sec/company?*', (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: {
          code: 'SEC_CONTACT_REQUIRED',
          message: 'Configure SEC_USER_AGENT on the server with a genuine contact email.',
        },
      },
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'SEC filings', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Find filings', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Configure SEC_USER_AGENT');
  await expect(dialog.locator('.sec-results')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const bounds = await dialog.boundingBox();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await expect(dialog.getByRole('button', { name: 'Find filings', exact: true })).toBeEnabled();
});

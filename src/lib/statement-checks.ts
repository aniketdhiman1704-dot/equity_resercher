import type { FinancialYear } from './types.ts';

/** USD millions: tolerate one displayed unit or 0.1% of the relevant total. */
export function statementIssues(row: FinancialYear, commonOnly = false): string[] {
  const issues: string[] = [];
  const check = (part: number | null, total: number | null, label: string) => {
    if (part !== null && total !== null && part - total > Math.max(1, Math.abs(total) * 0.001))
      issues.push(`${label}; check units, overlapping accounts and statement scope.`);
  };
  check(row.currentAssets, row.totalAssets, 'Current assets exceed total assets');
  check(
    row.currentLiabilities,
    row.totalLiabilities,
    'Current liabilities exceed total liabilities',
  );
  check(row.cash, row.currentAssets, 'Cash exceeds current assets');
  const liquid = [row.cash, row.shortTermInvestments, row.receivables];
  if (liquid.every((v) => v !== null))
    check(
      liquid.reduce<number>((sum, v) => sum + v!, 0),
      row.currentAssets,
      'Cash, short-term investments and receivables exceed current assets',
    );
  if (
    commonOnly &&
    row.totalAssets !== null &&
    row.totalLiabilities !== null &&
    row.equity !== null &&
    Math.abs(row.totalAssets - row.totalLiabilities - row.equity) >
      Math.max(1, Math.abs(row.totalAssets) * 0.001)
  )
    issues.push(
      'Assets do not reconcile to liabilities plus common equity under the confirmed no-preferred/no-NCI scope.',
    );
  return issues;
}

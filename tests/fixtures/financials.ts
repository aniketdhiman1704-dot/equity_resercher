/** Synthetic amounts and annual contexts; no assertion of real issuer financials. */
import { factsUrl, fixtureRecords, fixtureTransport, fixtureContact } from './sec';
import { SecClient } from '../../server/sec-client';
import { SecService } from '../../server/sec-service';
import { normalizeReports } from '../../server/normalize';

export interface TestFact {
  start?: string;
  end: string;
  val: number;
  accn: string;
  filed: string;
  form: string;
  fy: number;
  fp: string;
}
export function financialRecords() {
  const records = fixtureRecords();
  const concepts: Record<string, { units: { USD: TestFact[] } }> = {};
  for (const [tag, value, isDuration] of [
    ['Revenues', 1000, true],
    ['GrossProfit', 600, true],
    ['OperatingIncomeLoss', 200, true],
    ['NetIncomeLossAvailableToCommonStockholdersBasic', 150, true],
    ['DepreciationDepletionAndAmortization', 40, true],
    ['PaymentsToAcquirePropertyPlantAndEquipment', 60, true],
    ['NetCashProvidedByUsedInOperatingActivities', 230, true],
    ['Assets', 2000, false],
    ['Liabilities', 800, false],
    ['StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest', 1200, false],
    ['AssetsCurrent', 700, false],
    ['LiabilitiesCurrent', 300, false],
    ['CashAndCashEquivalentsAtCarryingValue', 200, false],
    ['AccountsReceivableNetCurrent', 250, false],
    ['ShortTermInvestments', 0, false],
    ['InterestExpenseNonOperating', 20, true],
  ] as const) {
    concepts[tag] = {
      units: {
        USD: [2019, 2020, 2021, 2022, 2023, 2024, 2025].map((year) => ({
          ...(isDuration ? { start: `${year - 1}-07-01` } : {}),
          end: `${year}-06-30`,
          val: value * 1e6,
          accn: `0000789019-${String(year).slice(-2)}-000001`,
          filed: `${year}-07-30`,
          form: '10-K',
          fy: year,
          fp: 'FY',
        })),
      },
    };
  }
  records[factsUrl] = {
    cik: 789019,
    entityName: 'Fixture Software (synthetic)',
    facts: { 'us-gaap': concepts },
  };
  return { records, concepts };
}
export async function normalizedFixture(setup = financialRecords(), years = 5) {
  const service = new SecService(
    new SecClient({
      userAgent: fixtureContact,
      transport: fixtureTransport(setup.records),
      intervalMs: 0,
    }),
  );
  const reports = await service.companyReports('MSFT', years);
  const document = await service.companyFacts(reports.company.cik);
  return { dataset: normalizeReports(reports, document), reports, document, service };
}

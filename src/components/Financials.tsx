import { useState } from 'react';
import { ArrowUpRight, Download, Info } from 'lucide-react';
import {
  type FinancialYear,
  type Metric,
  type FinancialField,
  type Dataset,
  fieldLabels,
} from '../lib/types';
import { ratios } from '../lib/finance';
import { amount, money, percent } from '../lib/format';
import { datasetCsv, downloadFile } from '../lib/csv';

export function metricValue(metric: Metric) {
  if (metric.value === null) return '—';
  return metric.unit === 'percent'
    ? percent(metric.value)
    : metric.unit === 'money'
      ? money(metric.value)
      : `${metric.value.toFixed(2)}×`;
}

const groups: { name: string; fields: FinancialField[] }[] = [
  {
    name: 'Income statement',
    fields: ['revenue', 'grossProfit', 'ebit', 'netIncome', 'interestExpense'],
  },
  {
    name: 'Balance sheet',
    fields: [
      'totalAssets',
      'totalLiabilities',
      'equity',
      'currentAssets',
      'currentLiabilities',
      'cash',
      'shortTermInvestments',
      'receivables',
      'debt',
      'operatingNwc',
    ],
  },
  { name: 'Cash flow inputs', fields: ['cashFromOperations', 'depreciation', 'capex'] },
];

export function Financials({
  dataset,
  years,
  onMetric,
}: {
  dataset: Dataset;
  years: FinancialYear[];
  onMetric: (metric: Metric) => void;
}) {
  const [section, setSection] = useState<'statements' | 'ratios'>('statements');
  return (
    <>
      <div className="section-title">
        <div>
          <h2>Financial history</h2>
          <p>Comparable annual periods. Every input stays visible.</p>
        </div>
        <button
          className="button secondary small"
          onClick={() =>
            downloadFile(
              datasetCsv({ ...dataset, years }),
              'financial-history.csv',
              'text/csv;charset=utf-8',
            )
          }
        >
          <Download size={15} /> Export CSV
        </button>
      </div>
      <section className="panel">
        <div className="panel-head">
          <div className="segmented">
            <button
              className={section === 'statements' ? 'active' : ''}
              onClick={() => setSection('statements')}
            >
              Statements
            </button>
            <button
              className={section === 'ratios' ? 'active' : ''}
              onClick={() => setSection('ratios')}
            >
              Financial ratios
            </button>
          </div>
          <span className="small muted">
            {section === 'statements' ? 'USD millions' : 'Select a metric to inspect its formula'}
          </span>
        </div>
        <div className="table-scroll" tabIndex={0} aria-label="Financial history table">
          <table className="financial-table">
            <thead>
              <tr>
                <th>{section === 'statements' ? 'Reported input' : 'Financial metric'}</th>
                {years.map((y) => (
                  <th key={y.fiscalYear}>FY {y.fiscalYear}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section === 'statements'
                ? groups.map((group) => (
                    <StatementsGroup key={group.name} group={group} years={years} />
                  ))
                : ratios(
                    years.at(-1)!,
                    dataset.years.find((y) => y.fiscalYear === years.at(-1)!.fiscalYear - 1),
                  ).map((metric) => (
                    <tr key={metric.id}>
                      <th>
                        <button className="table-link" onClick={() => onMetric(metric)}>
                          {metric.label}
                          <ArrowUpRight size={13} />
                        </button>
                      </th>
                      {years.map((y) => {
                        const m = ratios(
                          y,
                          dataset.years.find((p) => p.fiscalYear === y.fiscalYear - 1),
                        ).find((m) => m.id === metric.id)!;
                        return (
                          <td key={y.fiscalYear}>
                            <button
                              className="value-link"
                              title={m.value === null ? m.reason : m.formula}
                              onClick={() => onMetric(m)}
                            >
                              {metricValue(m)}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        <div className="panel-foot">
          <Info size={14} />
          <span>
            “—” means unavailable, never zero. Ratios requiring average balances use the preceding
            year where available.
          </span>
        </div>
      </section>
    </>
  );
}

function StatementsGroup({
  group,
  years,
}: {
  group: { name: string; fields: FinancialField[] };
  years: FinancialYear[];
}) {
  return (
    <>
      <tr className="group-row">
        <th colSpan={years.length + 1}>{group.name}</th>
      </tr>
      {group.fields.map((field) => (
        <tr key={field}>
          <th>{fieldLabels[field]}</th>
          {years.map((y) => (
            <td key={y.fiscalYear}>{amount(y[field])}</td>
          ))}
        </tr>
      ))}
    </>
  );
}

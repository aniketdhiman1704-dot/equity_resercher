import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  Check,
  Info,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import type { Assumptions, FinancialYear, Scenario } from '../lib/types';
import { scenarioAssumptions, tryValue, type Valuation as ValuationResult } from '../lib/finance';
import { amount, money, percent, price } from '../lib/format';
import { ForecastChart } from './Charts';

export const assumptionFields: {
  key: keyof Assumptions;
  label: string;
  detail: string;
  percent: boolean;
}[] = [
  { key: 'growth', label: 'Revenue growth', detail: 'Annual growth, years 1–5', percent: true },
  { key: 'margin', label: 'Operating margin', detail: 'EBIT as a share of revenue', percent: true },
  {
    key: 'taxRate',
    label: 'Operating tax rate',
    detail: 'No loss carryforward model',
    percent: true,
  },
  { key: 'daRate', label: 'D&A / revenue', detail: 'Non-cash operating expense', percent: true },
  {
    key: 'capexRate',
    label: 'CapEx / revenue',
    detail: 'Capital investment outflow',
    percent: true,
  },
  {
    key: 'nwcRate',
    label: 'Operating NWC / revenue',
    detail: 'Excludes cash and financing debt',
    percent: true,
  },
  { key: 'wacc', label: 'WACC', detail: 'Required return for debt + equity', percent: true },
  {
    key: 'terminalGrowth',
    label: 'Terminal growth',
    detail: 'Stable year 6 onward; below WACC',
    percent: true,
  },
  {
    key: 'excessCash',
    label: 'Excess cash',
    detail: 'Only cash not needed for operations',
    percent: false,
  },
  {
    key: 'debt',
    label: 'Interest-bearing debt',
    detail: 'Financing claims, not total liabilities',
    percent: false,
  },
  {
    key: 'nonOperatingAssets',
    label: 'Non-operating assets',
    detail: 'Value outside operating cash flows',
    percent: false,
  },
  {
    key: 'otherClaims',
    label: 'Other senior / minority claims',
    detail: 'Avoid double counting debt or leases',
    percent: false,
  },
];

export function ScenarioTabs({
  scenario,
  onChange,
}: {
  scenario: Scenario;
  onChange: (s: Scenario) => void;
}) {
  return (
    <div className="segmented scenarios" aria-label="Valuation scenario">
      {(['Bear', 'Base', 'Bull'] as Scenario[]).map((s) => (
        <button
          key={s}
          aria-pressed={s === scenario}
          className={s === scenario ? 'active' : ''}
          onClick={() => onChange(s)}
        >
          {s} case
        </button>
      ))}
    </div>
  );
}

export function Valuation({
  latest,
  assumptions,
  onAssumptions,
  onReset,
  scenario,
  onScenario,
  result,
  error,
  isDemo,
  approved,
  onApprove,
  assumptionNotes,
  onAssumptionNotes,
}: {
  latest: FinancialYear;
  assumptions: Assumptions;
  onAssumptions: (a: Assumptions) => void;
  onReset: () => void;
  scenario: Scenario;
  onScenario: (s: Scenario) => void;
  result: ValuationResult | null;
  error: string | null;
  isDemo: boolean;
  approved: boolean;
  onApprove: () => void;
  assumptionNotes: string;
  onAssumptionNotes: (notes: string) => void;
}) {
  const applied = scenarioAssumptions(assumptions, scenario);
  return (
    <>
      <div className="section-title">
        <div>
          <h2>A valuation you can explain</h2>
          <p>Five-year FCFF model · Year-end discounting · USD millions</p>
        </div>
        <ScenarioTabs scenario={scenario} onChange={onScenario} />
      </div>
      <div className="valuation-layout">
        <section className="panel assumptions-panel">
          <div className="panel-head">
            <h3>
              <SlidersHorizontal size={17} /> Base assumptions
            </h3>
            <button
              className="icon-button"
              title="Reset assumptions"
              aria-label="Reset assumptions"
              onClick={onReset}
            >
              <RotateCcw size={15} />
            </button>
          </div>
          <div className="assumptions-body">
            <p className="small muted">
              {isDemo
                ? 'Illustrative inputs for the fictional company. Edit to explore how the model responds.'
                : 'Review every input. Tax, WACC, and terminal growth are proposed starting values, not sourced facts.'}
            </p>
            {assumptionFields.map((field, i) => (
              <div key={field.key}>
                {(i === 0 || i === 6 || i === 8) && (
                  <div className="form-divider">
                    {i === 0
                      ? 'Operating forecast'
                      : i === 6
                        ? 'Discount rate & terminal value'
                        : 'Enterprise-to-equity bridge'}
                  </div>
                )}
                <label className="assumption-row">
                  <span>
                    <strong>{field.label}</strong>
                    <small>{field.detail}</small>
                  </span>
                  <span className="number-input">
                    <input
                      type="number"
                      step={field.percent ? '0.1' : '1'}
                      aria-label={field.label}
                      value={
                        Number.isFinite(assumptions[field.key])
                          ? Number((assumptions[field.key]! * (field.percent ? 100 : 1)).toFixed(6))
                          : ''
                      }
                      onChange={(e) =>
                        onAssumptions({
                          ...assumptions,
                          [field.key]:
                            e.target.value === ''
                              ? NaN
                              : Number(e.target.value) / (field.percent ? 100 : 1),
                        })
                      }
                    />
                    <span>{field.percent ? '%' : 'M'}</span>
                  </span>
                </label>
              </div>
            ))}
            <p className="small muted">
              Valuation date: {latest.periodEnd}. The forecast starts after this fiscal year-end;
              this is not a current market price target.
            </p>
            {!isDemo && (
              <label className="form-label">
                Assumption rationale
                <textarea
                  value={assumptionNotes}
                  maxLength={4000}
                  onChange={(e) => onAssumptionNotes(e.target.value)}
                  placeholder="Explain growth/margin, tax, reinvestment, WACC and terminal growth with sources/as-of dates; reconcile cash, debt and other claims. Avoid double counting cash in non-operating assets."
                />
              </label>
            )}
            {!isDemo && (
              <button
                className="button primary full-width"
                onClick={onApprove}
                disabled={approved || !!error || assumptionNotes.trim().length < 20}
              >
                {approved ? (
                  <>
                    <Check size={15} /> Inputs reviewed
                  </>
                ) : (
                  'Apply reviewed assumptions'
                )}
              </button>
            )}
            <p className="tiny muted">
              {isDemo
                ? '640M current diluted shares are a synthetic capitalization assumption, not weighted-average EPS shares.'
                : 'Results are enterprise and equity values. Per-share estimates require verified capitalization.'}
            </p>
          </div>
        </section>
        <div className="valuation-results">
          {error && (
            <div className="alert error" role="alert">
              <AlertCircle size={20} />
              <div>
                <strong>Review the model inputs</strong>
                <p>{error}</p>
              </div>
            </div>
          )}
          {!approved && !error && (
            <div className="alert">
              <Info size={20} />
              <div>
                <strong>Your assumptions need review</strong>
                <p>
                  Check the operating inputs and capital claims, then apply them to calculate a
                  valuation.
                </p>
              </div>
            </div>
          )}
          <section className="valuation-hero">
            <div>
              <span className="eyebrow">
                {scenario.toUpperCase()} CASE ·{' '}
                {isDemo ? 'ILLUSTRATIVE VALUE PER SHARE' : 'ESTIMATED EQUITY VALUE'}
              </span>
              <div className="valuation-number" data-testid="valuation-result">
                {result ? (isDemo ? price(result.perShare) : money(result.equityValue)) : '—'}
              </div>
              <span className="valuation-sub">
                {percent(applied.growth)} revenue growth · {percent(applied.margin)} operating
                margin
              </span>
            </div>
            <div className="valuation-hero-side">
              <span>Enterprise value</span>
              <strong>{result ? money(result.enterpriseValue) : '—'}</strong>
              <span>WACC {percent(applied.wacc)}</span>
            </div>
          </section>
          <p className="scenario-note">
            Bear / bull cases shift base revenue growth and operating margin by −2 / +2 percentage
            points. Other assumptions stay fixed. These are scenarios, not probabilities.
          </p>
          {result && result.equityValue <= 0 && (
            <p className="alert">
              The modeled enterprise and non-operating assets do not cover senior claims. This is a
              residual shortfall, not a negative tradable share price.
            </p>
          )}
          {result && (
            <>
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h3>Projected free cash flow</h3>
                    <p>Cash available to debt and equity capital providers</p>
                  </div>
                  <span className="badge neutral">Forecast</span>
                </div>
                <ForecastChart forecast={result.forecast} />
                <div className="panel-foot">
                  <Info size={14} />
                  <span>FCFF = EBIT × (1 − tax) + D&A − CapEx − change in operating NWC</span>
                </div>
              </section>
              <section className="panel">
                <div className="panel-head">
                  <h3>From business value to equity</h3>
                  <span className="small muted">USD millions</span>
                </div>
                <div className="bridge">
                  {[
                    ['Enterprise value', result.enterpriseValue],
                    ['+ Excess cash', applied.excessCash],
                    ['+ Non-operating assets', applied.nonOperatingAssets],
                    ['− Debt', -applied.debt],
                    ['− Other claims', -applied.otherClaims],
                    ['Equity value', result.equityValue],
                  ].map(([label, value], i) => (
                    <div key={label} className={i === 5 ? 'bridge-total' : ''}>
                      <span>{label}</span>
                      <strong>{money(value as number)}</strong>
                      {i === 0 && <ArrowDown size={14} />}
                    </div>
                  ))}
                </div>
              </section>
              <div className="model-notes">
                <Info size={17} />
                <div>
                  <strong>
                    {percent(result.terminalShare)} of enterprise value comes from terminal value.
                  </strong>
                  <p>
                    Year-six FCFF is {money(result.terminal.fcff)}, with{' '}
                    {percent(result.reinvestmentRate)} of NOPAT reinvested. Implied stable-state
                    ROIC: {percent(result.terminalRoic)}. Check that these assumptions are
                    economically plausible.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      {result && (
        <>
          <Sensitivity latest={latest} assumptions={applied} isDemo={isDemo} />
          <section className="panel forecast-table-panel">
            <div className="panel-head">
              <div>
                <h3>Inside the forecast</h3>
                <p>
                  Year six explicitly models the stable-growth cash flow used in terminal value.
                </p>
              </div>
              <span className="small muted">USD millions</span>
            </div>
            <div className="table-scroll" tabIndex={0} aria-label="DCF projection table">
              <table className="financial-table">
                <thead>
                  <tr>
                    <th>Operating driver</th>
                    {[...result.forecast, result.terminal].map((y) => (
                      <th key={y.year}>
                        {y.year}E{y === result.terminal ? ' · terminal' : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ['Revenue', 'revenue'],
                      ['Operating EBIT', 'ebit'],
                      ['NOPAT', 'nopat'],
                      ['+ Depreciation & amortization', 'depreciation'],
                      ['− Capital expenditure', 'capex'],
                      ['− Change in operating NWC', 'deltaNwc'],
                      ['Free cash flow to firm', 'fcff'],
                    ] as const
                  ).map(([label, key]) => (
                    <tr key={key} className={key === 'fcff' ? 'total-row' : ''}>
                      <th>{label}</th>
                      {[...result.forecast, result.terminal].map((y) => (
                        <td key={y.year}>{amount(y[key])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}

function Sensitivity({
  latest,
  assumptions,
  isDemo,
}: {
  latest: FinancialYear;
  assumptions: Assumptions;
  isDemo: boolean;
}) {
  const growthRates = [-0.01, -0.005, 0, 0.005, 0.01].map(
    (delta) => assumptions.terminalGrowth + delta,
  );
  const waccRates = [-0.02, -0.01, 0, 0.01, 0.02].map((delta) => assumptions.wacc + delta);
  return (
    <section className="panel sensitivity-panel">
      <div className="panel-head">
        <div>
          <h3>How much do assumptions matter?</h3>
          <p>
            {isDemo ? 'Value per share' : 'Equity value in USD millions'} across discount rates and
            terminal growth.
          </p>
        </div>
        <span className="badge neutral">Sensitivity</span>
      </div>
      <div className="sensitivity-content">
        <div className="sensitivity-label">
          Terminal growth <ArrowRight size={14} />
        </div>
        <div className="table-scroll">
          <table className="sensitivity-table">
            <thead>
              <tr>
                <th>WACC ↓</th>
                {growthRates.map((g) => (
                  <th key={g}>{percent(g)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {waccRates.map((wacc, row) => (
                <tr key={wacc}>
                  <th>{percent(wacc)}</th>
                  {growthRates.map((g, col) => {
                    const cell = tryValue(latest, { ...assumptions, wacc, terminalGrowth: g });
                    return (
                      <td
                        key={g}
                        className={`${row === 2 && col === 2 ? 'selected-cell' : ''} heat-${Math.max(0, Math.min(4, 2 + col - row))}`}
                        title={cell.error ?? `WACC ${percent(wacc)}; terminal growth ${percent(g)}`}
                      >
                        {cell.value
                          ? isDemo
                            ? price(cell.value.perShare)
                            : amount(cell.value.equityValue)
                          : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="tiny muted">
          Outlined cell = selected assumptions. Invalid combinations, including WACC ≤ terminal
          growth, are unavailable.
        </p>
      </div>
    </section>
  );
}

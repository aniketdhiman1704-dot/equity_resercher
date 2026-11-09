import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Calculator,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Database,
  FileCheck2,
  FileText,
  FlaskConical,
  Info,
  LayoutDashboard,
  Layers3,
  Menu,
  SearchCheck,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import type { Assumptions, Dataset, FinancialField, Metric, Scenario, View } from './lib/types';
import { fieldLabels, financialFields } from './lib/types';
import { sampleAssumptions, sampleDataset, sampleReferencePrice } from './lib/sample';
import {
  CALCULATION_VERSION,
  cagr,
  ratios,
  scenarioAssumptions,
  tryValue,
  valuationReadiness,
} from './lib/finance';
import { amount, money, percent, price } from './lib/format';
import { downloadFile } from './lib/csv';
import { HistoryChart, MarginsChart, Sparkline } from './components/Charts';
import { Modal } from './components/Modal';
import { UploadDialog } from './components/UploadDialog';
import { SecReportsDialog } from './components/SecReportsDialog';
import { ResearchPanel } from './components/ResearchPanel';
import { FinancialReview, FactSource } from './components/FinancialReview';
import type { ResearchRun } from './lib/research-types';
import { Financials, metricValue } from './components/Financials';
import { ScenarioTabs, Valuation } from './components/Valuation';
import { SessionDialog } from './components/SessionDialog';
import { serializeSession, type RestoredSession } from './lib/session';

const nav = [
  { name: 'Overview', label: 'Company overview', icon: LayoutDashboard },
  { name: 'Financials', label: 'Financial statements', icon: BarChart3 },
  { name: 'Valuation', label: 'DCF valuation', icon: Calculator },
  { name: 'Sources', label: 'Sources & evidence', icon: FileCheck2 },
] as const;

function initialAssumptions(dataset: Dataset): Assumptions {
  if (dataset.kind === 'demo') return { ...sampleAssumptions };
  const latest = dataset.years.at(-1)!;
  const first = dataset.years.slice(-5)[0];
  const revenue = latest.revenue;
  const rate = (v: number | null) =>
    v !== null && revenue !== null && revenue > 0 ? v / revenue : NaN;
  return {
    ...sampleAssumptions,
    growth: cagr(first.revenue, revenue, latest.fiscalYear - first.fiscalYear) ?? NaN,
    margin: rate(latest.ebit),
    daRate: rate(latest.depreciation),
    capexRate: rate(latest.capex),
    nwcRate: rate(latest.operatingNwc),
    debt: latest.debt ?? NaN,
    excessCash: 0,
    shares: null,
  };
}

export default function App() {
  const [view, setView] = useState<View>('Overview');
  const [dataset, setDataset] = useState<Dataset>(sampleDataset);
  const [historyLength, setHistoryLength] = useState(5);
  const [assumptions, setAssumptions] = useState<Assumptions>({ ...sampleAssumptions });
  const [approved, setApproved] = useState(true);
  const [assumptionNotes, setAssumptionNotes] = useState('');
  const [scenario, setScenario] = useState<Scenario>('Base');
  const [chartMode, setChartMode] = useState<'earnings' | 'cash'>('earnings');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [secOpen, setSecOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [methodOpen, setMethodOpen] = useState(false);
  const [metric, setMetric] = useState<Metric | null>(null);
  const [sourceYear, setSourceYear] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [researchRecord, setResearchRecord] = useState<{ key: string; run: ResearchRun } | null>(
    null,
  );
  const researchKey = JSON.stringify({
    dataset,
    assumptions,
    approved,
    historyLength,
    assumptionNotes,
  });
  const researchRun = researchRecord?.key === researchKey ? researchRecord.run : null;
  const years = dataset.years.slice(-Math.min(historyLength, 7));
  const latest = years.at(-1)!;
  const previous = dataset.years.find((y) => y.fiscalYear === latest.fiscalYear - 1);
  const metrics = useMemo(() => ratios(latest, previous), [latest, previous]);
  const applied = scenarioAssumptions(assumptions, scenario);
  const readinessIssue = valuationReadiness(dataset, applied);
  const calculated = readinessIssue
    ? { value: null, error: readinessIssue }
    : tryValue(latest, applied);
  const valuation =
    approved && (dataset.kind === 'demo' || assumptionNotes.trim().length >= 20)
      ? calculated.value
      : null;
  const isDemo = dataset.kind === 'demo';
  const isSec = dataset.kind === 'sec';
  const growth = cagr(years[0].revenue, latest.revenue, latest.fiscalYear - years[0].fiscalYear);
  const revenueYoy = cagr(previous?.revenue ?? null, latest.revenue, 1);
  const operatingMargin = metrics.find((m) => m.id === 'operatingMargin')!;
  const cashMetric = metrics.find((m) => m.id === 'cashAfterCapex')!;
  const visit = (next: View) => {
    setView(next);
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  function loadDataset(next: Dataset) {
    const refreshed =
      !!dataset.restoredAt && next.kind === 'sec' && dataset.sec?.cik === next.sec?.cik;
    setDataset(next);
    if (!refreshed) {
      setAssumptions(initialAssumptions(next));
      setAssumptionNotes('');
    }
    setApproved(next.kind === 'demo');
    if (!refreshed) setScenario('Base');
    setHistoryLength(Math.min(refreshed ? historyLength : 5, next.years.length));
    setResearchRecord(null);
    setSessionError('');
    setUploadOpen(false);
    setSecOpen(false);
    setSourceYear(null);
    setMetric(null);
    setNotice(
      refreshed
        ? 'SEC source refreshed. Your saved assumptions were kept; review them against the refreshed financials before valuation.'
        : next.kind === 'demo'
          ? 'Sample workspace restored.'
          : next.kind === 'sec'
            ? 'Reviewed SEC financials loaded. Review DCF assumptions separately.'
            : 'Financials imported locally. Review DCF assumptions before valuing the business.',
    );
    visit('Overview');
  }
  function saveSession() {
    setSessionError('');
    try {
      const content = serializeSession(
        dataset,
        assumptions,
        historyLength,
        scenario,
        assumptionNotes,
      );
      downloadFile(
        content,
        `equity-session-${dataset.company.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.equity.json`,
        'application/json',
      );
      setNotice(
        'Session downloaded. Use Open session to restore your data, assumptions and scenario. Keep private-company files somewhere you trust.',
      );
    } catch (e) {
      setSessionError(e instanceof Error ? e.message : 'Unable to save this session.');
    }
  }
  function restoreSession(saved: RestoredSession) {
    loadDataset(saved.dataset);
    setAssumptions(saved.assumptions);
    setAssumptionNotes(saved.assumptionNotes);
    setHistoryLength(saved.historyLength);
    setScenario(saved.scenario);
    setApproved(saved.dataset.kind === 'demo');
    setResearchRecord(null);
    setSessionOpen(false);
    setNotice(
      saved.dataset.kind === 'sec'
        ? 'Saved SEC snapshot opened locally. Refresh SEC filings before valuation or agent runs; your saved assumptions will be kept for review.'
        : 'Saved session opened locally. Results are recalculated; private-company DCF assumptions need approval again.',
    );
  }
  function exportReport() {
    const report = {
      title: `${dataset.company} — equity research`,
      exportedAt: new Date().toISOString(),
      calculationVersion: CALCULATION_VERSION,
      data: dataset,
      displayedYears: years.map((y) => y.fiscalYear),
      units: 'USD millions, except per-share figures in USD',
      financialRatios: metrics,
      researchRun,
      revenueCagr: growth,
      baseAssumptions: assumptions,
      assumptionNotes,
      valuationAsOf: latest.periodEnd,
      selectedScenario: scenario,
      appliedAssumptions: applied,
      assumptionStatus: isDemo
        ? 'Illustrative synthetic assumptions'
        : approved
          ? 'User reviewed in this session'
          : 'Not yet reviewed',
      valuation,
      valuationIssue: calculated.error ?? (!approved ? 'Assumptions need review.' : null),
      referencePrice: isDemo
        ? {
            amount: sampleReferencePrice,
            asOf: latest.periodEnd,
            status: 'Synthetic example, not a market quote',
          }
        : null,
      methodology:
        'Five-year annual FCFF at WACC; year-end discounting; explicit year-six drivers; perpetual-growth terminal value; enterprise-to-equity bridge.',
      limitations: [
        'SEC mappings require source review. Selected Microsoft facts were reconciled during development; that does not independently verify this report or other issuers. No live market-price feed.',
        'USD millions only. Private CSV requires calendar years; SEC mapping accepts comparable full fiscal years.',
        'Not a fully integrated three-statement model. Loss carryforwards and material financing leases need separate treatment.',
        'Non-sample capitalization is unverified; per-share values are withheld. Scenario outputs are estimates, not investment recommendations.',
      ],
    };
    downloadFile(
      JSON.stringify(report, null, 2),
      `equity-research-${dataset.company.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`,
      'application/json',
    );
    setNotice(
      'Research report downloaded as JSON, including source data, formulas, and current assumptions.',
    );
  }
  return (
    <div className="app-shell">
      {sidebarOpen && (
        <button
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            visit('Overview');
          }}
        >
          <span className="brand-icon">
            <BarChart3 size={22} strokeWidth={2.4} />
          </span>
          <span>
            equity<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="workspace-label">
          <span className="workspace-avatar">R</span>
          <div>
            <strong>Research workspace</strong>
            <small>Personal workspace</small>
          </div>
          <ChevronDown size={13} />
        </div>
        <span className="nav-label">RESEARCH</span>
        <nav aria-label="Main navigation">
          {nav.map((item) => (
            <button
              key={item.name}
              className={`nav-item ${view === item.name ? 'selected' : ''}`}
              aria-current={view === item.name ? 'page' : undefined}
              onClick={() => visit(item.name)}
            >
              <item.icon size={18} strokeWidth={1.7} />
              <span>{item.label}</span>
              {view === item.name && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <span className="nav-label">WORKSPACE</span>
        <button className="nav-item" onClick={() => setUploadOpen(true)}>
          <Upload size={18} strokeWidth={1.7} />
          <span>Import financials</span>
        </button>
        <button className="nav-item" onClick={() => setMethodOpen(true)}>
          <BookOpen size={18} strokeWidth={1.7} />
          <span>Research methodology</span>
        </button>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-icon">
              <Layers3 size={18} />
            </span>
            <strong>Clarity before conviction.</strong>
            <p>
              Understand the numbers.
              <br />
              Question the assumptions.
            </p>
            <button onClick={() => setMethodOpen(true)}>
              Explore the methodology <ArrowRight size={14} />
            </button>
          </div>
          <div className="workspace-status">
            <span className="status-dot" />
            <span>Local workspace</span>
            <span>v0.5</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{nav.find((n) => n.name === view)!.label}</strong>
          </div>
          <div className="topbar-right">
            <span className="local-label">
              <span className="status-dot" /> Calculation mode
            </span>
            <button
              className="icon-button"
              aria-label="About the methodology"
              onClick={() => setMethodOpen(true)}
            >
              <CircleHelp size={18} />
            </button>
            <span className="profile" aria-label="Personal workspace">
              R
            </span>
          </div>
        </header>
        <main id="main-content">
          <div className="page-intro">
            <div>
              <div className="eyebrow">THE RESEARCH DESK</div>
              <h1>
                {view === 'Overview'
                  ? 'Company overview'
                  : view === 'Financials'
                    ? 'Financial statements'
                    : view === 'Valuation'
                      ? 'DCF valuation'
                      : 'Sources & evidence'}
              </h1>
              <p>A clearer view of the business behind the numbers.</p>
            </div>
            <div className="page-actions">
              <button className="button secondary" onClick={saveSession}>
                Save session
              </button>
              <button className="button secondary" onClick={() => setSessionOpen(true)}>
                Open session
              </button>
              <button className="button secondary" onClick={() => visit('Sources')}>
                Research agents
              </button>
              <button className="button secondary" onClick={() => setSecOpen(true)}>
                <SearchCheck size={16} /> SEC filings
              </button>
              <button className="button secondary" onClick={() => setUploadOpen(true)}>
                <Upload size={16} /> Import financials
              </button>
              <button
                className="button primary"
                onClick={exportReport}
                title="Download a JSON research report"
              >
                <ArrowDownToLine size={16} /> Export report
              </button>
            </div>
          </div>
          {notice && (
            <div className="notice" role="status">
              <CheckCircle2 size={16} />
              <span>{notice}</span>
              <button
                className="icon-button"
                aria-label="Dismiss notification"
                onClick={() => setNotice('')}
              >
                <X size={14} />
              </button>
            </div>
          )}
          {sessionError && (
            <p className="alert error" role="alert">
              {sessionError}
            </p>
          )}
          {dataset.restoredAt && (
            <div className="alert">
              <div>
                <strong>Saved SEC snapshot</strong>
                <p>
                  These historical figures come from a local session file. Refresh and review the
                  SEC source to enable valuation and agents.
                </p>
                <button className="button secondary" onClick={() => setSecOpen(true)}>
                  Refresh SEC source
                </button>
              </div>
            </div>
          )}
          <div className={`data-banner ${isDemo ? '' : 'private-banner'}`}>
            <span>
              {isDemo ? <FlaskConical size={16} /> : <ShieldCheck size={16} />}
              <strong>
                {isDemo
                  ? 'Sample workspace'
                  : isSec
                    ? 'Public company workspace'
                    : 'Private company workspace'}
              </strong>
              <span>
                {isDemo
                  ? 'Explore with synthetic financials. No live market data.'
                  : isSec
                    ? 'Reviewed SEC mappings; manual entries are labelled. No live market quote.'
                    : 'User-provided financials. Nothing is sent to a server or AI provider.'}
              </span>
            </span>
            <button onClick={() => (isDemo ? setUploadOpen(true) : loadDataset(sampleDataset))}>
              {isDemo ? 'Use your own data' : 'Back to sample'}
              <ArrowRight size={14} />
            </button>
          </div>
          <section className="company-strip">
            <div className="company-identity">
              <span className="company-mark">
                <Layers3 size={28} strokeWidth={1.7} />
              </span>
              <div>
                <div className="company-title">
                  <h2>{dataset.company}</h2>
                  <span className="badge neutral">
                    {isDemo ? 'DEMO' : isSec ? 'PUBLIC' : 'PRIVATE'}
                  </span>
                </div>
                <div className="company-meta">
                  <span>
                    {isDemo
                      ? 'Enterprise software'
                      : isSec
                        ? 'SEC annual statements'
                        : 'Uploaded annual statements'}
                  </span>
                  <span className="separator">•</span>
                  <span>USD</span>
                  <span className="separator">•</span>
                  <span>FY {latest.fiscalYear}</span>
                </div>
              </div>
            </div>
            <div className="history-control">
              <label htmlFor="history-years">Historical period</label>
              <div className="select-wrap">
                <select
                  id="history-years"
                  value={historyLength}
                  onChange={(e) => setHistoryLength(Number(e.target.value))}
                >
                  {[3, 4, 5, 6, 7]
                    .filter((n) => n <= dataset.years.length)
                    .map((n) => (
                      <option key={n} value={n}>
                        {n} years
                      </option>
                    ))}
                </select>
                <ChevronDown size={13} />
              </div>
            </div>
          </section>

          {view === 'Overview' && (
            <>
              <div className="kpi-grid">
                <article className="kpi-card">
                  <div className="kpi-label">
                    Annual revenue{' '}
                    <button
                      className="icon-button"
                      aria-label="Inspect revenue source"
                      onClick={() => setSourceYear(latest.fiscalYear)}
                    >
                      <ArrowUpRight size={15} />
                    </button>
                  </div>
                  <div className="kpi-value-row">
                    <strong>{money(latest.revenue)}</strong>
                    <Sparkline values={years.map((y) => y.revenue)} />
                  </div>
                  <div className="kpi-caption">
                    <span
                      className={`trend ${revenueYoy !== null && revenueYoy < 0 ? 'negative' : ''}`}
                    >
                      {revenueYoy !== null && revenueYoy >= 0 ? '↗ +' : ''}
                      {percent(revenueYoy)}
                    </span>
                    <span>vs. prior year</span>
                  </div>
                </article>
                <article className="kpi-card">
                  <div className="kpi-label">
                    Operating margin{' '}
                    <button
                      className="icon-button"
                      aria-label="Inspect operating margin"
                      onClick={() => setMetric(operatingMargin)}
                    >
                      <ArrowUpRight size={15} />
                    </button>
                  </div>
                  <div className="kpi-value-row">
                    <strong>{percent(operatingMargin.value)}</strong>
                    <Sparkline
                      values={years.map((y) =>
                        y.ebit !== null && y.revenue ? y.ebit / y.revenue : null,
                      )}
                    />
                  </div>
                  <div className="kpi-caption">
                    <span className="caption-dot" /> EBIT / revenue
                    <span>FY {latest.fiscalYear}</span>
                  </div>
                </article>
                <article className="kpi-card">
                  <div className="kpi-label">
                    Cash flow after CapEx{' '}
                    <button
                      className="icon-button"
                      aria-label="Inspect cash flow after CapEx"
                      onClick={() => setMetric(cashMetric)}
                    >
                      <ArrowUpRight size={15} />
                    </button>
                  </div>
                  <div className="kpi-value-row">
                    <strong>{money(cashMetric.value)}</strong>
                    <Sparkline
                      values={years.map((y) =>
                        y.cashFromOperations !== null && y.capex !== null
                          ? y.cashFromOperations - y.capex
                          : null,
                      )}
                      gold
                    />
                  </div>
                  <div className="kpi-caption">
                    <span className="caption-dot gold" /> Operating cash less investment
                  </div>
                </article>
                <article className="kpi-card value-card">
                  <div className="kpi-label">
                    {isDemo ? 'Illustrative value / share' : 'Estimated equity value'}
                    <button
                      className="icon-button"
                      aria-label="Open valuation"
                      onClick={() => visit('Valuation')}
                    >
                      <ArrowUpRight size={15} />
                    </button>
                  </div>
                  <div className="kpi-value-row">
                    <strong data-testid="overview-valuation">
                      {valuation
                        ? isDemo
                          ? price(valuation.perShare)
                          : money(valuation.equityValue)
                        : '—'}
                    </strong>
                    <Calculator size={30} strokeWidth={1} />
                  </div>
                  <div className="kpi-caption">
                    {valuation ? (
                      <>
                        <span className="mini-badge">{scenario} case</span>
                        <span>FCFF valuation</span>
                      </>
                    ) : (
                      <button className="inline-link" onClick={() => visit('Valuation')}>
                        Review model inputs <ArrowRight size={13} />
                      </button>
                    )}
                  </div>
                </article>
              </div>
              <div className="overview-main-grid">
                <section className="panel performance-panel">
                  <div className="panel-head">
                    <div>
                      <h3>Business performance</h3>
                      <p>Growth, grounded in financial history</p>
                    </div>
                    <div className="segmented chart-tabs">
                      <button
                        className={chartMode === 'earnings' ? 'active' : ''}
                        onClick={() => setChartMode('earnings')}
                      >
                        Earnings
                      </button>
                      <button
                        className={chartMode === 'cash' ? 'active' : ''}
                        onClick={() => setChartMode('cash')}
                      >
                        Cash flow
                      </button>
                    </div>
                  </div>
                  <div className="chart-meta">
                    <div>
                      <span className="legend-dot" />
                      {chartMode === 'earnings' ? 'Revenue' : 'Operating cash flow'}
                      <span className="legend-dot light" />
                      {chartMode === 'earnings' ? 'Operating profit' : 'Cash flow after CapEx'}
                    </div>
                    <span>USD millions</span>
                  </div>
                  <HistoryChart years={years} mode={chartMode} />
                  <div className="chart-summary">
                    <span>
                      Revenue CAGR <strong>{percent(growth)}</strong>
                    </span>
                    <span>
                      {years.length - 1} annual growth intervals <Info size={13} />
                    </span>
                  </div>
                </section>
                <section className="panel valuation-summary">
                  <div className="panel-head">
                    <h3>Value, in perspective</h3>
                    <span className="outline-icon">
                      <Calculator size={17} />
                    </span>
                  </div>
                  <div className="valuation-summary-body">
                    <ScenarioTabs scenario={scenario} onChange={setScenario} />
                    <div className="summary-value">
                      {valuation
                        ? isDemo
                          ? price(valuation.perShare)
                          : money(valuation.equityValue)
                        : '—'}
                    </div>
                    <p className="small muted">
                      {isDemo ? 'Illustrative value per share' : 'Estimated equity value'}
                    </p>
                    <div className="valuation-track">
                      <span />
                      <span />
                      <span />
                    </div>
                    <div className="summary-key-values">
                      <div>
                        <span>Enterprise value</span>
                        <strong>{valuation ? money(valuation.enterpriseValue) : '—'}</strong>
                      </div>
                      <div>
                        <span>Discount rate (WACC)</span>
                        <strong>{percent(applied.wacc)}</strong>
                      </div>
                      <div>
                        <span>Terminal growth</span>
                        <strong>{percent(applied.terminalGrowth)}</strong>
                      </div>
                    </div>
                    {isDemo && valuation?.perShare !== null && valuation && (
                      <p className="comparison-note">
                        {percent(valuation.perShare! / sampleReferencePrice - 1)} vs. an
                        illustrative {price(sampleReferencePrice)} reference price. No live quote.
                      </p>
                    )}
                    <button
                      className="button secondary full-width"
                      onClick={() => visit('Valuation')}
                    >
                      Explore the valuation <ArrowRight size={15} />
                    </button>
                  </div>
                </section>
              </div>
              <div className="overview-bottom-grid">
                <section className="panel ratios-panel">
                  <div className="panel-head">
                    <div>
                      <h3>The fundamentals</h3>
                      <p>Key ratios · FY {latest.fiscalYear}</p>
                    </div>
                    <button className="text-button" onClick={() => visit('Financials')}>
                      View all <ArrowRight size={14} />
                    </button>
                  </div>
                  <div className="ratio-grid">
                    {[
                      'grossMargin',
                      'netMargin',
                      'roe',
                      'currentRatio',
                      'debtEquity',
                      'cashConversion',
                    ].map((id) => {
                      const m = metrics.find((m) => m.id === id)!;
                      return (
                        <button key={id} className="ratio-cell" onClick={() => setMetric(m)}>
                          <span>
                            {m.label}
                            <ArrowUpRight size={12} />
                          </span>
                          <strong>{metricValue(m)}</strong>
                          <small>{m.category}</small>
                        </button>
                      );
                    })}
                  </div>
                  <div className="panel-foot">
                    <SearchCheck size={14} /> Select any ratio to trace its calculation.
                  </div>
                </section>
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h3>Profitability over time</h3>
                      <p>Operating and net margins</p>
                    </div>
                    <Activity size={17} className="muted" />
                  </div>
                  <MarginsChart years={years} />
                </section>
              </div>
              <section className="evidence-strip">
                <span className="evidence-icon">
                  <FileCheck2 size={22} />
                </span>
                <div>
                  <h3>Every number has a starting point.</h3>
                  <p>
                    {years.length} annual periods ·{' '}
                    {isDemo
                      ? 'Synthetic source data, clearly labelled'
                      : 'Original file fingerprint and input references'}{' '}
                    · Formulas you can inspect
                  </p>
                </div>
                <button className="text-button" onClick={() => visit('Sources')}>
                  Explore the evidence <ArrowRight size={15} />
                </button>
              </section>
            </>
          )}
          {view === 'Financials' && (
            <Financials dataset={dataset} years={years} onMetric={setMetric} />
          )}
          {view === 'Valuation' && (
            <>
              {isSec && !dataset.restoredAt && (
                <button className="button secondary" onClick={() => setReviewOpen(true)}>
                  Review mappings
                </button>
              )}
              <Valuation
                latest={latest}
                assumptions={assumptions}
                onAssumptions={(a) => {
                  setAssumptions(a);
                  if (!isDemo) setApproved(false);
                }}
                onReset={() => {
                  setAssumptions(initialAssumptions(dataset));
                  setApproved(isDemo);
                  setScenario('Base');
                }}
                scenario={scenario}
                onScenario={setScenario}
                result={valuation}
                error={calculated.error}
                isDemo={isDemo}
                approved={approved}
                onApprove={() => setApproved(true)}
                assumptionNotes={assumptionNotes}
                onAssumptionNotes={(notes) => {
                  setAssumptionNotes(notes);
                  if (!isDemo) setApproved(false);
                }}
              />
            </>
          )}
          {view === 'Sources' && (
            <>
              {isSec && !dataset.restoredAt && (
                <button className="button secondary" onClick={() => setReviewOpen(true)}>
                  Review mappings
                </button>
              )}
              <div className="section-title">
                <div>
                  <h2>Evidence before conclusions</h2>
                  <p>Inspect the financial inputs behind this workspace.</p>
                </div>
                <span className="badge neutral">
                  <ShieldCheck size={13} />{' '}
                  {isDemo
                    ? 'Synthetic fixture'
                    : isSec
                      ? 'Reviewed SEC mapping'
                      : 'Browser-only import'}
                </span>
              </div>
              <div className="source-info">
                <Database size={21} />
                <div>
                  <strong>{dataset.source}</strong>
                  <p>
                    {isDemo
                      ? 'Every number is generated for teaching and product testing. This is not a public company or an SEC filing.'
                      : isSec
                        ? 'SEC facts and manual mappings were reviewed by the user. Source review is not independent verification; inspect the linked original statements and retained filing versions.'
                        : 'User-provided inputs are not audited or externally verified. Review the original statements alongside these normalized values.'}
                  </p>
                  {dataset.sourceHash && <p className="hash">SHA-256: {dataset.sourceHash}</p>}
                </div>
              </div>
              <section className="panel">
                <div className="panel-head">
                  <h3>Annual financial inputs</h3>
                  <span className="small muted">USD millions · Annual fiscal periods</span>
                </div>
                <div className="source-list">
                  {years
                    .slice()
                    .reverse()
                    .map((y) => (
                      <button
                        className="source-row"
                        key={y.fiscalYear}
                        onClick={() => setSourceYear(y.fiscalYear)}
                      >
                        <span className="file-icon">
                          <FileText size={21} />
                        </span>
                        <span>
                          <strong>FY {y.fiscalYear} financial statements</strong>
                          <small>
                            {y.periodStart} → {y.periodEnd}
                          </small>
                        </span>
                        <span className="source-state">
                          {financialFields.filter((f) => y[f] !== null).length} /{' '}
                          {financialFields.length} inputs
                        </span>
                        <span className="badge neutral">
                          {isDemo ? 'Synthetic' : isSec ? 'Source reviewed' : 'User supplied'}
                        </span>
                        <ChevronRight size={16} />
                      </button>
                    ))}
                </div>
                <div className="panel-foot">
                  <Info size={14} /> Input references use FYyear:field. Exports include the dataset
                  and calculation version {CALCULATION_VERSION}.
                </div>
              </section>
              <ResearchPanel
                key={researchKey}
                dataset={dataset}
                assumptions={assumptions}
                approved={approved}
                assumptionNotes={assumptionNotes}
                historyYears={years.length}
                run={researchRun}
                onRun={(run) => setResearchRecord({ key: researchKey, run })}
              />
            </>
          )}
          <footer className="page-footer">
            <span>
              <span className="footer-mark">e.</span> A little more evidence. A little less
              guesswork.
            </span>
            <span>
              {isDemo ? 'Synthetic data' : isSec ? 'SEC + reviewed mappings' : 'User-provided data'}
              <span className="separator">·</span>Not investment advice
            </span>
          </footer>
        </main>
      </div>
      {uploadOpen && <UploadDialog onClose={() => setUploadOpen(false)} onImport={loadDataset} />}
      {secOpen && (
        <SecReportsDialog
          onClose={() => setSecOpen(false)}
          onImport={loadDataset}
          initialIdentifier={dataset.sec?.cik}
        />
      )}
      {reviewOpen && (
        <Modal title="Review financial mappings" onClose={() => setReviewOpen(false)} wide>
          <FinancialReview
            dataset={dataset}
            onAccept={(next) => {
              // Update only inputs whose historical basis changed; retain intentional forecast edits.
              const seeded = initialAssumptions(next);
              const prior = initialAssumptions(dataset);
              setAssumptions(
                Object.fromEntries(
                  Object.entries(assumptions).map(([key, value]) => [
                    key,
                    Object.is(value, prior[key as keyof Assumptions])
                      ? seeded[key as keyof Assumptions]
                      : value,
                  ]),
                ) as unknown as Assumptions,
              );
              setDataset(next);
              setApproved(false);
              setResearchRecord(null);
              setReviewOpen(false);
              setNotice('Mappings updated. Review forecast assumptions separately.');
            }}
          />
        </Modal>
      )}
      {sessionOpen && (
        <SessionDialog onClose={() => setSessionOpen(false)} onRestore={restoreSession} />
      )}
      {metric && (
        <Modal title={metric.label} onClose={() => setMetric(null)}>
          <div className="metric-detail-value">{metricValue(metric)}</div>
          <p className="formula">{metric.formula}</p>
          {metric.value === null && <div className="alert">{metric.reason}</div>}
          <h3 className="modal-section-title">Inputs & evidence</h3>
          <div className="metric-inputs">
            {metric.inputs.map((id) => {
              const [yearId, field] = id.split(':');
              const row = dataset.years.find((y) => y.fiscalYear === Number(yearId.slice(2)));
              return (
                <div key={id}>
                  <span>
                    <strong>{fieldLabels[field as FinancialField]}</strong>
                    <small>{id}</small>
                    <FactSource dataset={dataset} id={id} />
                  </span>
                  <strong>
                    {amount(row?.[field as FinancialField] ?? null)}
                    <small>USD M</small>
                  </strong>
                </div>
              );
            })}
          </div>
          <p className="small muted">
            Source: {dataset.source}.{' '}
            {isDemo
              ? 'Synthetic inputs.'
              : isSec
                ? 'SEC mappings and any manual entries were reviewed by the user; inspect evidence below.'
                : 'User-supplied values; not independently verified.'}
          </p>
        </Modal>
      )}
      {sourceYear !== null && (
        <Modal title={`FY ${sourceYear} · source inputs`} onClose={() => setSourceYear(null)} wide>
          <p className="muted">
            {dataset.source} · USD millions ·{' '}
            {isDemo ? 'Synthetic' : isSec ? 'Reviewed SEC facts' : 'User provided'}
          </p>
          <div className="table-scroll">
            <table className="financial-table">
              <thead>
                <tr>
                  <th>Financial input</th>
                  <th>Reference</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {financialFields.map((f) => (
                  <tr key={f}>
                    <th>{fieldLabels[f]}</th>
                    <td className="source-id">
                      FY{sourceYear}:{f}
                      <FactSource dataset={dataset} id={`FY${sourceYear}:${f}`} />
                    </td>
                    <td>{amount(dataset.years.find((y) => y.fiscalYear === sourceYear)![f])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
      {methodOpen && (
        <Modal title="The thinking behind the numbers" onClose={() => setMethodOpen(false)} wide>
          <div className="methodology">
            <span className="badge green">
              <Check size={13} /> Calculation-first research
            </span>
            <h3>Understand the business. Make assumptions visible.</h3>
            <p>
              This first release is a small research workbench for non-financial operating
              companies. It uses deterministic financial formulas, with evidence references for each
              ratio. Three rule-based research workers organize source evidence and calculate
              results without a language model. No live market-price feed is connected.
            </p>
            <div className="method-grid">
              <article>
                <span>01</span>
                <h4>Read the history</h4>
                <p>
                  Compare 3–7 completed fiscal years. All amounts are USD millions. Missing data
                  stays unavailable; return ratios require opening and closing balances.
                </p>
              </article>
              <article>
                <span>02</span>
                <h4>Model the cash flows</h4>
                <p>
                  FCFF = EBIT × (1 − tax) + D&A − CapEx − change in operating working capital. The
                  five-year forecast has explicit, editable operating drivers.
                </p>
              </article>
              <article>
                <span>03</span>
                <h4>Value the capital</h4>
                <p>
                  Discount FCFF at WACC, add a year-six perpetual-growth terminal value, then bridge
                  enterprise value to equity. WACC must exceed terminal growth.
                </p>
              </article>
              <article>
                <span>04</span>
                <h4>Question the result</h4>
                <p>
                  Read the scenarios and sensitivity table. Banks, insurers, turnarounds, material
                  financing leases, and complex capitalization require separate methods.
                </p>
              </article>
            </div>
            <div className="alert">
              <Info size={19} />
              <div>
                <strong>A working model, with clear limits</strong>
                <p>
                  CSV imports support full calendar years only. The model is not a fully integrated
                  three-statement forecast. Uploads and edited assumptions last for this tab
                  session; use Save session and Open session to resume later. Export report retains
                  calculated results separately.
                </p>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

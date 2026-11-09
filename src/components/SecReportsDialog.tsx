import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowUpRight, Download, FileText, LoaderCircle, Search } from 'lucide-react';
import { Modal } from './Modal';
import { downloadFile } from '../lib/csv';
import type { SecCompanyReports } from '../lib/sec-types';
import type { Dataset } from '../lib/types';
import { FinancialReview } from './FinancialReview';

async function responseError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return body.error?.message ?? `Request failed (HTTP ${response.status}).`;
  } catch {
    return 'The SEC service is unavailable. Check that the application server is running.';
  }
}

export function SecReportsDialog({
  onClose,
  onImport,
  initialIdentifier,
}: {
  onClose: () => void;
  onImport: (dataset: Dataset) => void;
  initialIdentifier?: string;
}) {
  const [identifier, setIdentifier] = useState(initialIdentifier ?? 'MSFT');
  const [years, setYears] = useState(5);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<SecCompanyReports | null>(null);
  const [normalized, setNormalized] = useState<Dataset | null>(null);
  const [mapping, setMapping] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);

  async function search() {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setLoading(true);
    setResult(null);
    setNormalized(null);
    setError('');
    const timer = setTimeout(() => controller.abort(), 150_000);
    try {
      const response = await fetch(
        `/api/sec/company?identifier=${encodeURIComponent(identifier.trim())}&years=${years}`,
        { signal: controller.signal },
      );
      if (!response.ok) throw new Error(await responseError(response));
      setResult((await response.json()) as SecCompanyReports);
    } catch (e) {
      if (controller.signal.aborted)
        setError('Lookup cancelled or timed out. No incomplete result was loaded.');
      else setError(e instanceof Error ? e.message : 'Unable to retrieve SEC filings.');
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }

  async function mapFinancials() {
    if (!result) return;
    setMapping(true);
    setError('');
    setNormalized(null);
    try {
      const response = await fetch(
        `/api/sec/normalized?identifier=${result.company.cik}&years=${result.requestedYears}&sha256=${result.facts.sha256}`,
        { signal: AbortSignal.timeout(150_000) },
      );
      if (!response.ok) throw new Error(await responseError(response));
      setNormalized(await response.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Financial mapping failed.');
    } finally {
      setMapping(false);
    }
  }

  async function downloadFacts() {
    if (!result) return;
    setDownloading(true);
    setError('');
    try {
      const response = await fetch(result.facts.downloadPath);
      if (!response.ok) throw new Error(await responseError(response));
      downloadFile(
        await response.text(),
        `SEC-CIK${result.company.cik}-companyfacts.json`,
        'application/json',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Modal title="Find official SEC filings" onClose={onClose} wide>
      <p className="muted small">
        Find annual reports and raw financial facts for a US issuer. Try Microsoft (MSFT), a
        non-financial company with a long reporting history.
      </p>
      <form
        className="sec-search-form"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <label className="form-label">
          Ticker or CIK
          <input
            required
            maxLength={13}
            value={identifier}
            disabled={loading || mapping}
            placeholder="MSFT or 0000789019"
            onChange={(e) => {
              setIdentifier(e.target.value);
              setResult(null);
            }}
            autoComplete="off"
          />
        </label>
        <label className="form-label">
          Annual periods
          <select
            aria-label="SEC annual periods"
            value={years}
            disabled={loading || mapping}
            onChange={(e) => {
              setYears(Number(e.target.value));
              setResult(null);
            }}
          >
            {[3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n} years
              </option>
            ))}
          </select>
        </label>
        <button
          className="button primary"
          type="submit"
          disabled={loading || mapping || !identifier.trim()}
        >
          {loading ? <LoaderCircle size={16} className="loading-icon" /> : <Search size={16} />}
          {loading ? 'Finding filings…' : 'Find filings'}
        </button>
      </form>
      {loading && (
        <p className="small muted" role="status">
          Retrieving SEC records at a controlled rate. Older filing history can take a little
          longer.
        </p>
      )}
      {error && (
        <div className="alert error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}
      {result && (
        <div className="sec-results">
          <div className="sec-result-heading">
            <div>
              <h3>{result.company.name}</h3>
              <p>
                CIK {result.company.cik} · {result.company.tickers.join(', ') || 'No ticker listed'}{' '}
                · {result.company.industry || 'Industry not supplied'}
              </p>
            </div>
            <span className="badge neutral">
              {result.periods.length} / {result.requestedYears} periods
            </span>
          </div>
          <div className="alert">
            <FileText size={18} />
            <div>
              <strong>Filing discovery complete; financial mapping pending.</strong>
              <p>
                These filings have not been loaded into the dashboard. Annual contexts, accounting
                tags, and restatements need review before ratios or valuation can use them.
              </p>
            </div>
          </div>
          <div className="sec-filings">
            {result.periods.map((period) => (
              <article key={period.periodEnd} className="sec-filing">
                <div>
                  <strong>Year ended {period.periodEnd}</strong>
                  <span className="badge neutral">10-K</span>
                </div>
                <p>
                  Filed {period.annual.filed} · {period.annual.accession}
                </p>
                <div className="sec-filing-links">
                  <a href={period.annual.documentUrl} target="_blank" rel="noreferrer">
                    Read annual report <ArrowUpRight size={13} />
                  </a>
                  <a href={period.annual.indexUrl} target="_blank" rel="noreferrer">
                    Filing index <ArrowUpRight size={13} />
                  </a>
                </div>
                {period.amendments.map((amendment) => (
                  <p key={amendment.accession} className="amendment">
                    <a href={amendment.documentUrl} target="_blank" rel="noreferrer">
                      10-K/A amendment · {amendment.filed} <ArrowUpRight size={12} />
                    </a>
                  </p>
                ))}
              </article>
            ))}
          </div>
          <button
            className="button primary"
            onClick={() => void mapFinancials()}
            disabled={mapping}
          >
            {mapping ? 'Mapping annual facts…' : 'Review financial history'}
          </button>
          {normalized && <FinancialReview dataset={normalized} onAccept={onImport} />}
          <div className="sec-facts">
            <div>
              <h3>Raw XBRL financial facts</h3>
              <p>
                {result.facts.conceptCount.toLocaleString()} concepts across{' '}
                {result.facts.taxonomyCount} taxonomies. Values and original SEC contexts are
                preserved.
              </p>
              <p>
                Retrieved{' '}
                {new Date(result.facts.retrievedAt).toISOString().slice(0, 19).replace('T', ' ')}{' '}
                UTC
              </p>
              <code>SHA-256: {result.facts.sha256}</code>
            </div>
            <button
              className="button secondary"
              onClick={() => void downloadFacts()}
              disabled={downloading}
            >
              <Download size={15} />
              {downloading ? 'Downloading…' : 'Download raw facts'}
            </button>
          </div>
          <details className="sec-details">
            <summary>Source records & limitations</summary>
            <ul>
              {result.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
            {result.submissionSources.map((source) => (
              <div key={source.url}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  SEC submission metadata <ArrowUpRight size={12} />
                </a>
                <code>{source.sha256}</code>
              </div>
            ))}
          </details>
        </div>
      )}
      {!result && !loading && (
        <div className="upload-instructions">
          <FileText size={18} />
          <p>
            This retrieves official 10-K filing records and raw XBRL data. It does not run an AI
            agent or automatically treat every SEC tag as a comparable financial statement.
          </p>
        </div>
      )}
    </Modal>
  );
}

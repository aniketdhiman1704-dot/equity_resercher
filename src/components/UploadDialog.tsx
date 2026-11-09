import { useRef, useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  Download,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { Modal } from './Modal';
import { datasetCsv, downloadFile, parseFinancialCsv, sourceHash } from '../lib/csv';
import { sampleDataset } from '../lib/sample';
import type { Dataset, FinancialYear } from '../lib/types';

export function UploadDialog({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (dataset: Dataset) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<FinancialYear[] | null>(null);
  const [filename, setFilename] = useState('');
  const [hash, setHash] = useState('');
  const [company, setCompany] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function select(file?: File) {
    if (!file) return;
    setError('');
    setRows(null);
    setConfirmed(false);
    setLoading(true);
    try {
      if (!file.name.toLowerCase().endsWith('.csv'))
        throw new Error(
          'Choose a CSV file. Excel and PDF extraction are planned, but not available yet.',
        );
      if (file.size > 1_000_000) throw new Error('The file must be smaller than 1 MB.');
      const text = await file.text();
      const parsed = parseFinancialCsv(text);
      const fingerprint = await sourceHash(text);
      setRows(parsed);
      setHash(fingerprint);
      setFilename(file.name);
      setCompany(
        file.name
          .replace(/\.csv$/i, '')
          .replace(/[_-]/g, ' ')
          .slice(0, 80),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read file.');
    } finally {
      setLoading(false);
      if (input.current) input.current.value = '';
    }
  }
  return (
    <Modal title="Bring your financials" onClose={onClose}>
      <p className="muted">
        Upload a private company’s annual statements using the CSV template. Your file stays in this
        browser tab.
      </p>
      <button
        className="dropzone"
        disabled={loading}
        onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!loading) void select(e.dataTransfer.files[0]);
        }}
      >
        <span className="upload-icon">
          <Upload size={24} />
        </span>
        <strong>
          {loading ? 'Checking financial statements…' : 'Choose a CSV or drop it here'}
        </strong>
        <span>3–7 annual periods · USD millions · Up to 1 MB</span>
      </button>
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        aria-label="Financial CSV file"
        className="sr-only"
        onChange={(e) => void select(e.target.files?.[0])}
      />
      <button
        className="text-button"
        onClick={() =>
          downloadFile(
            datasetCsv(sampleDataset),
            'equity-template-synthetic.csv',
            'text/csv;charset=utf-8',
          )
        }
      >
        <Download size={16} /> Download template with synthetic examples
      </button>
      <div className="upload-instructions">
        <FileSpreadsheet size={18} />
        <p>
          Replace the example values, keep the column names, and leave unavailable amounts blank.
          Use full January–December fiscal years. CapEx is a positive outflow. An eighth row may
          supply opening balances.
        </p>
      </div>
      {error && (
        <div className="alert error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}
      {rows && (
        <div className="import-review">
          <div className="success-line">
            <CheckCircle2 size={18} />
            <strong>{rows.length} consecutive years parsed</strong>
            <span>
              FY{rows[0].fiscalYear}–{rows.at(-1)!.fiscalYear}
            </span>
          </div>
          <label className="form-label">
            Company name
            <input value={company} maxLength={80} onChange={(e) => setCompany(e.target.value)} />
          </label>
          <p className="small muted">
            {rows.some((r) => Object.values(r).some((v) => v === null))
              ? 'Some financial values are missing. Affected ratios will be unavailable.'
              : 'All template fields are present.'}{' '}
            File: {filename}
          </p>
          <label className="check-label">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>
              I reviewed the mapping and units. These are annual statements for a non-financial
              operating company, with net income and equity attributable to common shareholders, and
              no material preferred interests, minority interests, or unresolved financing leases.
            </span>
          </label>
        </div>
      )}
      <div className="modal-actions">
        <span className="privacy">
          <ShieldCheck size={15} /> No server upload
        </span>
        <button
          className="button primary"
          disabled={!rows || !confirmed || !company.trim() || loading}
          onClick={() =>
            onImport({
              company: company.trim(),
              kind: 'upload',
              source: filename,
              sourceHash: hash,
              years: rows!,
            })
          }
        >
          Use financials
        </button>
      </div>
    </Modal>
  );
}

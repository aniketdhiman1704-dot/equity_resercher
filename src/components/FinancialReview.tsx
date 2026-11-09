import { useState } from 'react';
import { applySourceReview } from '../lib/review';
import {
  financialFields,
  fieldLabels,
  factId,
  type Dataset,
  type FactOverride,
} from '../lib/types';
import { amount } from '../lib/format';

export function FactSource({ dataset, id }: { dataset: Dataset; id: string }) {
  const fact = dataset.sec?.evidence[id];
  if (!fact) return null;
  return (
    <details className="fact-evidence">
      <summary>{fact.status}</summary>
      <p>{fact.reason}</p>
      {fact.candidates.map((c, i) => (
        <p key={`${c.tag}:${c.accession}:${i}`}>
          <a href={c.url} target="_blank" rel="noreferrer">
            {c.tag} · filed {c.filed}
          </a>
          <br />
          {c.start ? `${c.start} → ` : ''}
          {c.end} · {amount(c.value)} USD M · {c.accession}
          {c.accession === fact.selected?.accession &&
          c.tag === fact.selected.tag &&
          c.value === fact.selected.value
            ? ' · selected'
            : ''}
        </p>
      ))}
    </details>
  );
}

export function FinancialReview({
  dataset,
  onAccept,
}: {
  dataset: Dataset;
  onAccept: (dataset: Dataset) => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [notes, setNotes] = useState(dataset.sec?.review?.notes ?? '');
  const [valuationConfirmed, setValuationConfirmed] = useState(false);
  const [valuationNotes, setValuationNotes] = useState(dataset.sec?.review?.valuationNotes ?? '');
  const [edits, setEdits] = useState<Record<string, { value: string; reason: string }>>(() =>
    Object.fromEntries(
      (dataset.sec?.review?.overrides ?? []).map((o) => [
        o.id,
        { value: String(o.value), reason: o.reason },
      ]),
    ),
  );
  const [error, setError] = useState('');
  const sec = dataset.sec!;
  function accept() {
    setError('');
    try {
      const overrides: FactOverride[] = Object.entries(edits)
        .filter(([, edit]) => edit.value.trim())
        .map(([id, edit]) => ({ id, value: Number(edit.value), reason: edit.reason.trim() }));
      onAccept(
        applySourceReview(dataset, {
          confirmed,
          notes,
          overrides,
          valuationConfirmed,
          valuationNotes,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Review failed.');
    }
  }

  return (
    <section className="financial-review">
      <h3>Review annual financial history</h3>
      <p className="small muted">
        USD millions. Expand a period to inspect source tags and filing versions. Blank inputs stay
        unavailable. Manual entries require a statement reference and definition; they are labelled
        user-entered.
      </p>
      {sec.blockingIssues.length > 0 && (
        <div className="alert error" role="alert">
          <div>
            <strong>History cannot be loaded</strong>
            <ul>
              {sec.blockingIssues.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <details className="sec-details">
        <summary>Mapping limitations and review checklist</summary>
        <ul>
          {sec.issues.map((v, i) => (
            <li key={i}>{v}</li>
          ))}
        </ul>
        <p>
          Operating NWC excludes cash, investments and financing debt. Total debt needs both current
          and non-current interest-bearing obligations; review lease treatment. Common equity and
          earnings must exclude preferred and non-controlling interests. D&amp;A and CapEx must
          cover the same operating asset scope. Do not enter zero merely because a tag is missing.
        </p>
      </details>
      <details className="sec-details">
        <summary>How to map the remaining inputs</summary>
        <ul>
          <li>
            Common net income: reconcile reported net income to preferred dividends and
            non-controlling interests. A broad net-income tag alone is not proof.
          </li>
          <li>
            D&amp;A: use depreciation and amortization for the same operating assets as EBIT and
            CapEx. A line labelled “and other” needs a breakdown.
          </li>
          <li>
            Debt: reconcile current and non-current interest-bearing borrowing; do not add a total
            to its components or use total liabilities. Explain lease treatment.
          </li>
          <li>
            Operating NWC: list operating receivables, inventory and other operating current assets,
            less operating payables, accruals and deferred revenue. Exclude cash, investments and
            financing debt; state tax/lease treatment.
          </li>
          <li>
            Common equity: reconcile consolidated equity to preferred and non-controlling interests.
          </li>
          <li>Interest: use gross interest expense, not interest income netted against expense.</li>
        </ul>
        <p>
          For every entry, record the filing, statement or note, component amounts and arithmetic.
          Leave unresolved values blank; zero is a financial assertion.
        </p>
      </details>
      {[...dataset.years].reverse().map((y) => (
        <details className="sec-details" key={y.fiscalYear}>
          <summary>
            FY {y.fiscalYear} · {y.periodStart || 'Unresolved start'} → {y.periodEnd}
          </summary>
          <div className="table-scroll">
            <table className="financial-table">
              <thead>
                <tr>
                  <th>Input</th>
                  <th>USD M</th>
                  <th>Evidence / manual mapping</th>
                </tr>
              </thead>
              <tbody>
                {financialFields.map((field) => {
                  const id = factId(y.fiscalYear, field);
                  const edit = edits[id] ?? { value: '', reason: '' };
                  return (
                    <tr key={id}>
                      <th>{fieldLabels[field]}</th>
                      <td>
                        {sec.evidence[id]?.selected ? (
                          amount(y[field])
                        ) : (
                          <input
                            aria-label={`${id} manual value`}
                            type="number"
                            step="any"
                            value={edit.value}
                            onChange={(e) =>
                              setEdits({ ...edits, [id]: { ...edit, value: e.target.value } })
                            }
                          />
                        )}
                      </td>
                      <td>
                        <FactSource dataset={dataset} id={id} />
                        {!sec.evidence[id]?.selected && edit.value && (
                          <input
                            aria-label={`${id} source note`}
                            placeholder="Statement page, scope and calculation"
                            maxLength={1000}
                            value={edit.reason}
                            onChange={(e) =>
                              setEdits({ ...edits, [id]: { ...edit, reason: e.target.value } })
                            }
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      ))}
      <label className="form-label">
        Source review note
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          placeholder="Which statements and mappings did you review? Note unresolved limitations."
        />
      </label>
      <label className="review-check">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />{' '}
        I checked the historical periods, units and accepted mappings against the linked statements.
        Common earnings and equity, if entered, use common-shareholder scope. Missing inputs remain
        unavailable.
      </label>
      <p className="small muted">
        Historical analysis can be loaded while valuation scope is unresolved.
      </p>
      <label className="review-check">
        <input
          type="checkbox"
          checked={valuationConfirmed}
          onChange={(e) => setValuationConfirmed(e.target.checked)}
        />
        I also reviewed DCF suitability: a profitable non-financial operating company, consistent
        EBIT, D&amp;A and CapEx scope, and no material unresolved preferred interests,
        non-controlling interests or financing leases.
      </label>
      <label className="form-label">
        Valuation scope note
        <textarea
          value={valuationNotes}
          onChange={(e) => setValuationNotes(e.target.value)}
          maxLength={2000}
          placeholder="Explain lease treatment, operating accounts and capital claims. Leave suitability unchecked if unresolved."
        />
      </label>
      {error && (
        <p role="alert" className="alert error">
          {error}
        </p>
      )}
      <button
        className="button primary"
        disabled={
          !confirmed ||
          notes.trim().length < 10 ||
          (valuationConfirmed && valuationNotes.trim().length < 20) ||
          !!sec.blockingIssues.length
        }
        onClick={accept}
      >
        Load reviewed financials
      </button>
    </section>
  );
}

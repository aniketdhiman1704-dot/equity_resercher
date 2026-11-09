import { useEffect, useRef, useState } from 'react';
import type { Assumptions, Dataset } from '../lib/types';
import type { ResearchRun, ResearchRequest } from '../lib/research-types';
import { amount, percent } from '../lib/format';
import { runResearch } from '../lib/research';

export function ResearchPanel({
  dataset,
  assumptions,
  approved,
  assumptionNotes,
  historyYears,
  run,
  onRun,
}: {
  dataset: Dataset;
  assumptions: Assumptions;
  approved: boolean;
  assumptionNotes: string;
  historyYears: number;
  run: ResearchRun | null;
  onRun: (run: ResearchRun) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  async function start() {
    if (dataset.restoredAt) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError('');
    const finite = Object.values(assumptions).every((v) => v === null || Number.isFinite(v));
    const source: ResearchRequest['source'] =
      dataset.kind === 'sec'
        ? {
            kind: 'sec',
            cik: dataset.sec!.cik,
            years: dataset.sec!.requestedYears,
            sha256: dataset.sourceHash!,
            review: dataset.sec!.review!,
          }
        : { kind: 'demo' };
    try {
      if (dataset.kind !== 'sec') {
        const result = await runResearch(
          { ...dataset, years: dataset.years.slice(-historyYears) },
          finite ? assumptions : null,
          approved,
          undefined,
          assumptionNotes,
        );
        if (!controller.signal.aborted) onRun(result);
        return;
      }
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          assumptions: finite ? assumptions : null,
          approved,
          assumptionNotes,
          historyYears,
        } satisfies ResearchRequest),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(180_000)]),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? 'Research failed.');
      if (!controller.signal.aborted) onRun(result);
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Research failed.');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <section className="agent-section">
      <div className="section-title">
        <div>
          <h2>Three research agents</h2>
          <p>
            Reports → fundamentals → DCF. Three rule-based workers use source evidence and tested
            financial formulas. No paid APIs or model keys.
          </p>
        </div>
      </div>
      {dataset.restoredAt ? (
        <p className="alert">
          Refresh and review this saved SEC source before running research. Saved figures have not
          been verified against SEC in this session.
        </p>
      ) : (
        <>
          <p className="small muted">
            {dataset.kind === 'sec'
              ? 'Public sources are rechecked on the server before research.'
              : 'Research runs entirely in this browser. Your financial data is not uploaded.'}
          </p>
          <button className="button primary" onClick={() => void start()} disabled={busy}>
            {busy ? 'Running research…' : 'Run research'}
          </button>
        </>
      )}
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      {run && (
        <>
          <p className="small muted">
            Run {run.id} · {new Date(run.createdAt).toLocaleString()} · Included in JSON report
            export.
          </p>
          <div className="agent-grid">
            {run.agents.map((agent) => (
              <article className="panel agent-card" key={agent.role}>
                <span className="badge neutral">Rule-based analysis</span>
                <h3>
                  {agent.role === 'dcf' ? 'DCF' : agent.role[0].toUpperCase() + agent.role.slice(1)}{' '}
                  agent
                </h3>
                {agent.highlights.map((id) => {
                  const e = agent.evidence.find((item) => item.id === id)!;
                  return (
                    <div className="research-finding" key={id}>
                      <h4>{e.label}</h4>
                      {e.value !== undefined && (
                        <strong>
                          {e.value === null
                            ? 'Unavailable'
                            : e.unit === 'percent'
                              ? percent(e.value)
                              : `${amount(e.value)}${e.unit === 'money' ? ' USD M' : '×'}`}
                        </strong>
                      )}
                      <p>{e.text}</p>
                      <small>{e.id}</small>
                      <details>
                        <summary>Inputs</summary>
                        {e.inputs.length ? (
                          e.inputs.map((input) => (
                            <p key={input}>
                              {input.startsWith('https://www.sec.gov/') ? (
                                <a href={input} target="_blank" rel="noreferrer">
                                  Official filing
                                </a>
                              ) : (
                                input
                              )}
                            </p>
                          ))
                        ) : (
                          <p>Source metadata or workflow status.</p>
                        )}
                      </details>
                    </div>
                  );
                })}
                <details>
                  <summary>Tool audit trail</summary>
                  {agent.trace.map((t, i) => (
                    <p key={i}>
                      {t.tool} · {t.status} · {t.evidenceIds.length} evidence IDs
                    </p>
                  ))}
                </details>
              </article>
            ))}
          </div>
        </>
      )}
      {!run && (
        <p className="small muted">
          No research run yet. All three workers run without a language model. DCF remains withheld
          until its inputs and assumptions are complete and reviewed.
        </p>
      )}
    </section>
  );
}

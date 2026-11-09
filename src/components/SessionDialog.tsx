import { useRef, useState } from 'react';
import { Modal } from './Modal';
import { MAX_SESSION_BYTES, parseSession, type RestoredSession } from '../lib/session';

export function SessionDialog({
  onClose,
  onRestore,
}: {
  onClose: () => void;
  onRestore: (session: RestoredSession) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const sequence = useRef(0);
  const [session, setSession] = useState<RestoredSession | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  async function read(file?: File) {
    if (!file) return;
    const request = ++sequence.current;
    setSession(null);
    setError('');
    setConfirmed(false);
    setBusy(true);
    try {
      if (file.size > MAX_SESSION_BYTES) throw new Error('Keep session files under 5 MB.');
      const result = parseSession(await file.text());
      if (request === sequence.current) setSession(result);
    } catch (e) {
      if (request === sequence.current)
        setError(e instanceof Error ? e.message : 'Unable to open this session.');
    } finally {
      if (request === sequence.current) setBusy(false);
      if (input.current) input.current.value = '';
    }
  }
  return (
    <Modal title="Open a saved session" onClose={onClose}>
      <p className="muted">
        Choose a file created with Save session. Reading it stays in your browser. Your current
        workspace is replaced only after you review and open it.
      </p>
      <button className="button secondary" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? 'Checking session…' : 'Choose session file'}
      </button>
      <input
        ref={input}
        className="sr-only"
        type="file"
        accept=".json,application/json"
        aria-label="Saved session file"
        onChange={(e) => void read(e.target.files?.[0])}
      />
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      {session && (
        <div className="import-review">
          <h3>{session.dataset.company}</h3>
          <p>
            {session.dataset.kind === 'demo'
              ? 'Synthetic sample'
              : session.dataset.kind === 'sec'
                ? 'Saved SEC snapshot'
                : 'Private company'}{' '}
            · {session.historyLength} displayed years · {session.scenario} scenario
          </p>
          <p>Saved {new Date(session.savedAt).toLocaleString()}. Figures use USD millions.</p>
          <p>
            {session.dataset.kind === 'sec'
              ? 'Saved source links and numbers are a local snapshot, not freshly verified SEC data. Refresh SEC filings and review the mapping before DCF or agent runs. Your saved assumptions will be kept for review.'
              : 'Results are recalculated from the saved inputs. Private-company assumptions need approval again. Previous agent runs are not restored.'}
          </p>
          <label className="check-label">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>
              I reviewed the saved inputs and their source. Replace the current workspace; unsaved
              changes will be lost.
            </span>
          </label>
        </div>
      )}
      <div className="modal-actions">
        <span className="privacy">No server upload</span>
        <button
          className="button primary"
          disabled={!session || !confirmed || busy}
          onClick={() => onRestore(session!)}
        >
          Open session
        </button>
      </div>
    </Modal>
  );
}

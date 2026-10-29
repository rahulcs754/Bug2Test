import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { describeStep, generateSpec } from '../core/generate';
import { removeStep } from '../core/steps';
import { DEFAULT_SETTINGS, type Recording, type Settings } from '../core/types';
import { originPattern } from '../shared/origin';
import {
  EMPTY_STATE,
  getSettings,
  getState,
  type BgMessage,
  type OpenPrResponse,
  type RecorderState,
} from '../shared/messages';
import '../ui.css';

const send = <T,>(msg: BgMessage) => chrome.runtime.sendMessage<BgMessage, T>(msg);

function useStorage() {
  const [state, setState] = useState<RecorderState>(EMPTY_STATE);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  useEffect(() => {
    void getState().then(setState);
    void getSettings().then(setSettings);
    const onChange = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes.state) setState(changes.state.newValue as RecorderState);
      if (changes.settings) void getSettings().then(setSettings);
    };
    chrome.storage.local.onChanged.addListener(onChange);
    return () => chrome.storage.local.onChanged.removeListener(onChange);
  }, []);
  return { state, settings };
}

function Popup() {
  const { state, settings } = useStorage();
  const { rec, recording } = state;
  const [error, setError] = useState('');
  const [prUrl, setPrUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const spec = useMemo(() => {
    try {
      return { ...generateSpec(rec, settings), error: '' };
    } catch (e) {
      return { code: '', fileName: '', envVars: [], error: (e as Error).message };
    }
  }, [rec, settings]);

  async function start() {
    setError('');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url || !/^https?:/.test(tab.url)) {
      setError('Open the web page with the bug first (http or https).');
      return;
    }
    // Ask for this site only, so recording keeps working after page changes.
    const granted = await chrome.permissions.request({ origins: [originPattern(tab.url)] });
    if (!granted) {
      setError('Bug2Test needs access to this site to record.');
      return;
    }
    await send({ type: 'start', tabId: tab.id, url: tab.url });
  }

  async function addExpect() {
    await send({ type: 'pickExpect' });
    window.close(); // let the tester click on the page
  }

  async function openPr() {
    setBusy(true);
    setError('');
    setPrUrl('');
    const res = await send<OpenPrResponse>({ type: 'openPr' });
    setBusy(false);
    if (res.ok) setPrUrl(res.url);
    else setError(res.error);
  }

  async function copy() {
    await navigator.clipboard.writeText(spec.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function download() {
    const url = URL.createObjectURL(new Blob([spec.code], { type: 'text/plain' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: spec.fileName });
    a.click();
    URL.revokeObjectURL(url);
  }

  const update = (patch: Partial<Pick<Recording, 'title' | 'actual' | 'steps'>>) => send({ type: 'update', patch });
  const hasRepo = Boolean(settings.owner && settings.repo && settings.token);
  const hasSteps = rec.steps.length > 0;

  return (
    <div style={{ width: 400, padding: 14 }}>
      <div className="row spread">
        <h1>🐞 Bug2Test</h1>
        <button onClick={() => chrome.runtime.openOptionsPage()} title="Settings">
          ⚙ Settings
        </button>
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        {!recording && (
          <button className="primary" onClick={start}>
            {hasSteps ? '● New recording' : '● Start recording'}
          </button>
        )}
        {recording && (
          <>
            <span className="dot" aria-hidden /> <span>Recording…</span>
            <button className="primary" onClick={addExpect} title="Click the broken element on the page">
              ✓ Add expect
            </button>
            <button onClick={() => send({ type: 'stop' })}>■ Stop</button>
          </>
        )}
        {!recording && hasSteps && (
          <>
            <button onClick={addExpect}>✓ Add expect</button>
            <button className="danger" onClick={() => send({ type: 'reset' })}>
              Clear
            </button>
          </>
        )}
      </div>
      {!hasSteps && (
        <p className="hint">
          1. Start recording. 2. Repeat the bug. 3. Click <b>Add expect</b> on the broken element and say what it
          should be. 4. Open a PR.
        </p>
      )}

      {hasSteps && (
        <>
          <label htmlFor="title">Bug title</label>
          <input
            id="title"
            value={rec.title}
            placeholder="Cart total does not update after removing item"
            onChange={(e) => update({ title: e.target.value })}
          />
          <label htmlFor="actual">What happened instead?</label>
          <textarea
            id="actual"
            rows={2}
            value={rec.actual}
            placeholder="Total still shows ₹998"
            onChange={(e) => update({ actual: e.target.value })}
          />

          <h2>Steps ({rec.steps.length})</h2>
          <ol className="steps">
            {rec.steps.map((s, i) => (
              <li key={i} className={s.type === 'expect' ? 'expect' : ''}>
                <span className="tag">{i + 1}</span>
                <span className="text" title={describeStep(s).replace(/\*\*/g, '')}>
                  {describeStep(s).replace(/\*\*/g, '')}
                </span>
                <button
                  aria-label={`Delete step ${i + 1}`}
                  onClick={() => update({ steps: removeStep(rec.steps, i) })}
                >
                  ✕
                </button>
              </li>
            ))}
          </ol>
          {(rec.consoleErrors.length > 0 || rec.networkFailures.length > 0) && (
            <p className="hint">
              Captured {rec.consoleErrors.length} console error(s) and {rec.networkFailures.length} failed request(s).
              They go in the PR description.
            </p>
          )}

          <h2>Playwright test</h2>
          {spec.error ? <p className="error">{spec.error}</p> : <pre>{spec.code}</pre>}

          <div className="row" style={{ marginTop: 10 }}>
            <button onClick={copy} disabled={!spec.code}>
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button onClick={download} disabled={!spec.code}>
              Download
            </button>
            <button
              className="primary"
              onClick={openPr}
              disabled={!spec.code || !hasRepo || busy || recording}
              title={!hasRepo ? 'Set repo and token in Settings' : recording ? 'Stop recording first' : ''}
            >
              {busy ? 'Opening PR…' : 'Open PR'}
            </button>
          </div>
          {!hasRepo && <p className="hint">Add your GitHub repo and token in Settings to open PRs.</p>}
        </>
      )}

      {error && <p className="error">{error}</p>}
      {prUrl && (
        <p className="ok">
          PR opened:{' '}
          <a href={prUrl} target="_blank" rel="noreferrer">
            {prUrl}
          </a>
        </p>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);

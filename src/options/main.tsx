import { StrictMode, useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { DEFAULT_SETTINGS, type Settings } from '../core/types';
import { getSettings, saveSettings } from '../shared/messages';
import '../ui.css';

type TextKey = Exclude<keyof Settings, 'sensitive'>;

const FIELDS: { key: TextKey; label: string; hint: string; placeholder?: string; secret?: boolean }[] = [
  { key: 'owner', label: 'Repo owner', hint: 'GitHub user or org.', placeholder: 'acme' },
  { key: 'repo', label: 'Repo name', hint: 'Where the test PR is opened.', placeholder: 'shop' },
  { key: 'baseBranch', label: 'Base branch', hint: 'PRs target this branch.' },
  {
    key: 'token',
    label: 'GitHub token',
    hint: 'Fine-grained token for this repo only, with Contents and Pull requests: Read and write. Stored only in this browser.',
    secret: true,
  },
  { key: 'testDir', label: 'Test folder', hint: 'Where the spec file goes in the repo.' },
  {
    key: 'baseURL',
    label: 'App base URL',
    hint: 'Same as baseURL in playwright.config. URLs on this origin become paths like /cart.',
    placeholder: 'http://localhost:3000',
  },
  { key: 'testIdAttribute', label: 'Test id attribute', hint: 'Used first when picking selectors.' },
];

function Options() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void getSettings().then(setSettings);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const clean: Settings = {
      ...settings,
      owner: settings.owner.trim(),
      repo: settings.repo.trim(),
      baseBranch: settings.baseBranch.trim() || 'main',
      token: settings.token.trim(),
      baseURL: settings.baseURL.trim().replace(/\/+$/, ''),
    };
    await saveSettings(clean);
    setSettings(clean);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form onSubmit={onSubmit} style={{ maxWidth: 560, margin: '24px auto', padding: '0 16px' }}>
      <h1>🐞 Bug2Test settings</h1>
      {FIELDS.map((f) => (
        <div key={f.key}>
          <label htmlFor={f.key}>{f.label}</label>
          <input
            id={f.key}
            type={f.secret ? 'password' : 'text'}
            autoComplete="off"
            value={settings[f.key]}
            placeholder={f.placeholder}
            onChange={(e) => setSettings({ ...settings, [f.key]: e.target.value })}
          />
          <p className="hint">{f.hint}</p>
        </div>
      ))}
      <label htmlFor="sensitive">Never record fields named like</label>
      <input
        id="sensitive"
        value={settings.sensitive.join(', ')}
        onChange={(e) =>
          setSettings({
            ...settings,
            sensitive: e.target.value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          })
        }
      />
      <p className="hint">
        Password fields are always skipped. Matching fields become env vars like <code>B2T_PASSWORD</code>. You can
        also add <code>data-bug2test-sensitive</code> to any input.
      </p>
      <div className="row" style={{ marginTop: 16 }}>
        <button className="primary" type="submit">
          Save
        </button>
        {saved && <span className="ok">Saved</span>}
      </div>
    </form>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Options />
  </StrictMode>,
);

import { generateSpec, prBody, slugify } from '../core/generate';
import { openPullRequest } from '../core/github';
import { addStep } from '../core/steps';
import {
  emptyRecording,
  getSettings,
  getState,
  setState,
  type BgMessage,
  type ContentMessage,
  type OpenPrResponse,
  type RecorderState,
} from '../shared/messages';
import { originPattern } from '../shared/origin';

const SCRIPT_IDS = ['b2t-page', 'b2t-content'];
const MAX_LOGS = 50;

// Steps arrive fast (one per key press). Run updates one at a time so none are lost.
let queue: Promise<unknown> = Promise.resolve();
function update(fn: (s: RecorderState) => RecorderState | Promise<RecorderState>): Promise<RecorderState> {
  const next = queue.then(async () => {
    const state = await fn(await getState());
    await setState(state);
    return state;
  });
  queue = next.catch(() => undefined);
  return next;
}

async function setBadge(recording: boolean) {
  await chrome.action.setBadgeText({ text: recording ? 'REC' : '' });
  await chrome.action.setBadgeBackgroundColor({ color: '#d93025' });
}

async function unregister() {
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: SCRIPT_IDS });
  if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: existing.map((s) => s.id) });
}

async function start(tabId: number, url: string) {
  const matches = [originPattern(url)];
  await unregister();
  // Registered scripts keep recording after the page navigates (same site only).
  await chrome.scripting.registerContentScripts([
    { id: 'b2t-page', matches, js: ['page.js'], runAt: 'document_start', world: 'MAIN', persistAcrossSessions: false },
    { id: 'b2t-content', matches, js: ['content.js'], runAt: 'document_start', persistAcrossSessions: false },
  ]);
  await update(() => ({
    recording: true,
    tabId,
    origin: new URL(url).origin,
    rec: { ...emptyRecording(), startUrl: url, steps: [{ type: 'goto', url }] },
  }));
  // And inject now into the page that is already open.
  await chrome.scripting.executeScript({ target: { tabId }, files: ['page.js'], world: 'MAIN' });
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  await sendToTab(tabId, { type: 'setRecording', recording: true });
  await setBadge(true);
}

async function stop() {
  const state = await update((s) => ({ ...s, recording: false }));
  await unregister();
  if (state.tabId != null) await sendToTab(state.tabId, { type: 'setRecording', recording: false });
  await setBadge(false);
}

async function sendToTab(tabId: number, msg: ContentMessage) {
  try {
    await chrome.tabs.sendMessage(tabId, msg);
  } catch {
    // Tab closed or page has no content script (e.g. chrome:// page). Nothing to do.
  }
}

async function openPr(): Promise<OpenPrResponse> {
  const [state, settings] = await Promise.all([getState(), getSettings()]);
  if (!settings.owner || !settings.repo || !settings.token) {
    return { ok: false, error: 'Set repo and token in Bug2Test options first.' };
  }
  try {
    const spec = generateSpec(state.rec, settings);
    const path = `${settings.testDir.replace(/\/+$/, '')}/${spec.fileName}`;
    const title = state.rec.title.trim() || 'recorded bug';
    const pr = await openPullRequest({
      token: settings.token,
      owner: settings.owner,
      repo: settings.repo,
      base: settings.baseBranch,
      branch: `bug2test/${slugify(title)}-${Date.now().toString(36)}`,
      path,
      content: spec.code,
      title,
      body: prBody(state.rec, path),
    });
    return { ok: true, url: pr.url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function handle(msg: BgMessage, sender: chrome.runtime.MessageSender): Promise<unknown> {
  // Content-script messages only count from the tab being recorded.
  const fromTab = sender.tab?.id;
  const fromRecordedTab = async () => {
    const s = await getState();
    return s.recording && fromTab === s.tabId;
  };

  switch (msg.type) {
    case 'start':
      return start(msg.tabId, msg.url);
    case 'stop':
      return stop();
    case 'reset':
      await stop();
      return update((s) => ({ ...s, tabId: null, origin: '', rec: emptyRecording() }));
    case 'pickExpect': {
      const s = await getState();
      if (s.tabId != null) await sendToTab(s.tabId, { type: 'pickExpect' });
      return;
    }
    case 'step':
      // Expect steps are allowed after stop too; actions only while recording.
      if (msg.step.type !== 'expect' && !(await fromRecordedTab())) return;
      return update((s) => ({ ...s, rec: { ...s.rec, steps: addStep(s.rec.steps, msg.step) } }));
    case 'consoleError':
      if (!(await fromRecordedTab())) return;
      return update((s) => ({
        ...s,
        rec: { ...s.rec, consoleErrors: [...s.rec.consoleErrors, msg.text.slice(0, 500)].slice(-MAX_LOGS) },
      }));
    case 'networkFailure':
      if (!(await fromRecordedTab())) return;
      return update((s) => ({
        ...s,
        rec: { ...s.rec, networkFailures: [...s.rec.networkFailures, msg.failure].slice(-MAX_LOGS) },
      }));
    case 'update':
      return update((s) => ({ ...s, rec: { ...s.rec, ...msg.patch } }));
    case 'openPr':
      return openPr();
  }
}

chrome.runtime.onMessage.addListener((msg: BgMessage, sender, sendResponse) => {
  handle(msg, sender).then(sendResponse, (e: unknown) =>
    sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) }),
  );
  return true;
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const s = await getState();
  if (s.recording && s.tabId === tabId) await stop();
});

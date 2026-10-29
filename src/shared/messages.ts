import type { NetworkFailure, Recording, Settings, Step } from '../core/types';
import { DEFAULT_SETTINGS } from '../core/types';

/** State kept by the background worker in chrome.storage.local. */
export interface RecorderState {
  recording: boolean;
  tabId: number | null;
  origin: string;
  rec: Recording;
}

export const emptyRecording = (): Recording => ({
  title: '',
  actual: '',
  startUrl: '',
  steps: [],
  consoleErrors: [],
  networkFailures: [],
});

export const EMPTY_STATE: RecorderState = { recording: false, tabId: null, origin: '', rec: emptyRecording() };

/** Messages sent to the background worker. */
export type BgMessage =
  | { type: 'start'; tabId: number; url: string }
  | { type: 'stop' }
  | { type: 'reset' }
  | { type: 'pickExpect' }
  | { type: 'step'; step: Step }
  | { type: 'consoleError'; text: string }
  | { type: 'networkFailure'; failure: NetworkFailure }
  | { type: 'update'; patch: Partial<Pick<Recording, 'title' | 'actual' | 'steps'>> }
  | { type: 'openPr' };

/** Messages sent to the content script. */
export type ContentMessage = { type: 'pickExpect' } | { type: 'setRecording'; recording: boolean };

export type OpenPrResponse = { ok: true; url: string } | { ok: false; error: string };

export async function getState(): Promise<RecorderState> {
  const { state } = await chrome.storage.local.get('state');
  return (state as RecorderState | undefined) ?? structuredClone(EMPTY_STATE);
}

export async function setState(state: RecorderState): Promise<void> {
  await chrome.storage.local.set({ state });
}

export async function getSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings as Partial<Settings> | undefined) };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ settings });
}

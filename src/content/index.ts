import { interactiveAncestor, pickLocator } from '../core/locator';
import { sensitiveEnv } from '../core/steps';
import type { Assertion, Locator, Step } from '../core/types';
import { getSettings, type BgMessage, type ContentMessage } from '../shared/messages';
import { showExpectPanel } from './expect-panel';

declare global {
  interface Window {
    __bug2test?: { setRecording: (on: boolean) => void };
  }
}

if (window.__bug2test) {
  // Injected again (stop -> start on the same page). The first copy keeps working.
  window.__bug2test.setRecording(true);
} else {
  void init();
}

async function init() {
  let recording = true;
  let picking = false;
  window.__bug2test = { setRecording: (on) => (recording = on) };
  const settings = await getSettings();

  const send = (msg: BgMessage) => chrome.runtime.sendMessage(msg).catch(() => undefined);
  const locate = (el: Element): Locator => pickLocator(el, settings.testIdAttribute);
  const isOurs = (e: Event) => e.composedPath().some((n) => n instanceof Element && n.hasAttribute('data-bug2test'));
  const record = (step: Step) => recording && send({ type: 'step', step });

  // ----- Recorder -----

  const TEXT_INPUTS = new Set(['text', 'email', 'search', 'tel', 'url', 'number', 'password', 'date', 'time', '']);
  const isTextField = (el: Element): el is HTMLInputElement | HTMLTextAreaElement =>
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLInputElement && TEXT_INPUTS.has(el.type.toLowerCase()));
  const isToggle = (el: Element): el is HTMLInputElement =>
    el instanceof HTMLInputElement && ['checkbox', 'radio'].includes(el.type);

  document.addEventListener(
    'click',
    (e) => {
      if (!recording || picking || isOurs(e) || !(e.target instanceof Element)) return;
      const el = interactiveAncestor(e.target, settings.testIdAttribute);
      // Focus clicks on fields, toggles and selects are covered by fill/check/select steps.
      if (isTextField(el) || isToggle(el) || el instanceof HTMLSelectElement) return;
      if (el instanceof HTMLLabelElement && el.control && (isToggle(el.control) || isTextField(el.control))) return;
      record({ type: 'click', target: locate(el) });
    },
    true,
  );

  document.addEventListener(
    'input',
    (e) => {
      if (!recording || isOurs(e) || !(e.target instanceof Element) || !isTextField(e.target)) return;
      const el = e.target;
      const env = sensitiveEnv(
        {
          type: el instanceof HTMLInputElement ? el.type : 'textarea',
          name: el.name,
          id: el.id,
          autocomplete: el.getAttribute('autocomplete'),
          sensitiveAttr: el.hasAttribute('data-bug2test-sensitive'),
        },
        settings.sensitive,
      );
      record(
        env ? { type: 'fill', target: locate(el), value: '', env } : { type: 'fill', target: locate(el), value: el.value },
      );
    },
    true,
  );

  document.addEventListener(
    'change',
    (e) => {
      if (!recording || isOurs(e) || !(e.target instanceof Element)) return;
      const el = e.target;
      if (el instanceof HTMLSelectElement) record({ type: 'select', target: locate(el), value: el.value });
      else if (isToggle(el)) record({ type: 'check', target: locate(el), checked: el.checked });
    },
    true,
  );

  document.addEventListener(
    'keydown',
    (e) => {
      if (!recording || picking || isOurs(e) || !(e.target instanceof Element)) return;
      if (e.key !== 'Enter' && e.key !== 'Escape') return;
      record({ type: 'press', target: locate(interactiveAncestor(e.target, settings.testIdAttribute)), key: e.key });
    },
    true,
  );

  // Console errors and failed requests come from page.js in the page world.
  window.addEventListener('message', (e) => {
    if (e.source !== window || !recording || !e.data?.__bug2test) return;
    const d = e.data as { kind: string; text?: string; method?: string; url?: string; status?: number };
    if (d.kind === 'consoleError' && d.text) send({ type: 'consoleError', text: d.text });
    if (d.kind === 'networkFailure' && d.url) {
      send({ type: 'networkFailure', failure: { method: d.method ?? 'GET', url: d.url, status: d.status ?? 0 } });
    }
  });

  // ----- Expect picker -----

  function pickExpect() {
    if (picking) return;
    picking = true;
    const box = document.createElement('div');
    box.setAttribute('data-bug2test', '');
    Object.assign(box.style, {
      position: 'fixed',
      pointerEvents: 'none',
      zIndex: '2147483646',
      outline: '2px solid #7c3aed',
      background: 'rgba(124, 58, 237, 0.12)',
      borderRadius: '3px',
      transition: 'all 60ms',
    });
    document.documentElement.appendChild(box);

    let current: Element | null = null;
    const onMove = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el === box) return;
      current = el;
      const r = el.getBoundingClientRect();
      Object.assign(box.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    };
    const block = (e: Event) => {
      if (isOurs(e)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    const done = () => {
      picking = false;
      box.remove();
      window.removeEventListener('mousemove', onMove, true);
      for (const t of ['mousedown', 'mouseup', 'pointerdown', 'pointerup']) window.removeEventListener(t, block, true);
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('keydown', onKey, true);
    };
    const onClick = (e: MouseEvent) => {
      block(e);
      const el = current ?? (e.target instanceof Element ? e.target : null);
      done();
      if (!el) return;
      showExpectPanel(el, (assertion: Assertion) => {
        const step: Step =
          assertion.kind === 'url' ? { type: 'expect', assertion } : { type: 'expect', target: locate(el), assertion };
        void send({ type: 'step', step });
      });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        block(e);
        done();
      }
    };
    window.addEventListener('mousemove', onMove, true);
    for (const t of ['mousedown', 'mouseup', 'pointerdown', 'pointerup']) window.addEventListener(t, block, true);
    window.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKey, true);
  }

  chrome.runtime.onMessage.addListener((msg: ContentMessage) => {
    if (msg.type === 'pickExpect') pickExpect();
    if (msg.type === 'setRecording') recording = msg.recording;
  });
}

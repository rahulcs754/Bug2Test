import type { Assertion } from '../core/types';

const CSS = `
  :host { all: initial; }
  .panel { position: fixed; z-index: 2147483647; width: 300px; background: #fff; color: #1f2328;
    font: 13px/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; border: 1px solid #d0d7de;
    border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,.18); padding: 12px; }
  h2 { font-size: 13px; margin: 0 0 8px; }
  label { display: flex; gap: 6px; align-items: center; margin: 6px 0; cursor: pointer; }
  input[type=text] { flex: 1; min-width: 0; padding: 4px 6px; border: 1px solid #d0d7de; border-radius: 6px; font: inherit; }
  .row { display: flex; gap: 8px; justify-content: flex-end; margin-top: 10px; }
  button { font: inherit; padding: 5px 12px; border-radius: 6px; border: 1px solid #d0d7de; background: #f6f8fa; cursor: pointer; }
  button.primary { background: #7c3aed; border-color: #7c3aed; color: #fff; }
`;

/** What the element shows now, to prefill the "has text" box. */
function currentValue(el: Element): { kind: 'text' | 'value'; value: string } {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    return { kind: 'value', value: el.value };
  }
  return { kind: 'text', value: (el.textContent ?? '').replace(/\s+/g, ' ').trim() };
}

/**
 * Small panel next to the picked element: "what SHOULD this be?".
 * Built with Shadow DOM so the page's CSS cannot break it.
 */
export function showExpectPanel(el: Element, onAdd: (a: Assertion) => void) {
  const host = document.createElement('div');
  host.setAttribute('data-bug2test', '');
  const root = host.attachShadow({ mode: 'open' });
  const cur = currentValue(el);
  root.innerHTML = `
    <style>${CSS}</style>
    <div class="panel" role="dialog" aria-label="Bug2Test expect">
      <h2>What should happen here?</h2>
      <label><input type="radio" name="k" value="text" checked> Should ${cur.kind === 'value' ? 'have value' : 'have text'}
        <input type="text" name="text"></label>
      <label><input type="radio" name="k" value="visible"> Should be visible</label>
      <label><input type="radio" name="k" value="hidden"> Should be hidden</label>
      <label><input type="radio" name="k" value="enabled"> Should be enabled</label>
      <label><input type="radio" name="k" value="url"> Page URL should be
        <input type="text" name="url"></label>
      <div class="row"><button type="button" data-act="cancel">Cancel</button>
        <button type="button" class="primary" data-act="add">Add expect</button></div>
    </div>`;
  const panel = root.querySelector<HTMLElement>('.panel')!;
  const text = root.querySelector<HTMLInputElement>('input[name=text]')!;
  const url = root.querySelector<HTMLInputElement>('input[name=url]')!;
  text.value = cur.value;
  url.value = location.href;

  // Place under the element, kept inside the viewport.
  const r = el.getBoundingClientRect();
  panel.style.left = `${Math.max(8, Math.min(r.left, innerWidth - 316))}px`;
  panel.style.top = `${r.bottom + 230 < innerHeight ? r.bottom + 8 : Math.max(8, r.top - 238)}px`;

  const close = () => host.remove();
  const choose = (k: string) => {
    const radio = root.querySelector<HTMLInputElement>(`input[value=${k}]`);
    if (radio) radio.checked = true;
  };
  text.addEventListener('focus', () => choose('text'));
  url.addEventListener('focus', () => choose('url'));

  root.querySelector('[data-act=cancel]')!.addEventListener('click', close);
  root.querySelector('[data-act=add]')!.addEventListener('click', () => {
    const k = root.querySelector<HTMLInputElement>('input[name=k]:checked')?.value;
    let a: Assertion;
    if (k === 'text') a = { kind: cur.kind, value: text.value };
    else if (k === 'url') a = { kind: 'url', value: url.value };
    else a = { kind: k as 'visible' | 'hidden' | 'enabled' };
    onAdd(a);
    close();
  });
  root.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Escape') close();
  });

  document.documentElement.appendChild(host);
  text.focus();
  text.select();
}

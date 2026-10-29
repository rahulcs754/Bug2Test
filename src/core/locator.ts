import type { Locator } from './types';

const IMPLICIT_ROLES: Record<string, string> = {
  BUTTON: 'button',
  SELECT: 'combobox',
  TEXTAREA: 'textbox',
  NAV: 'navigation',
  MAIN: 'main',
  DIALOG: 'dialog',
  H1: 'heading',
  H2: 'heading',
  H3: 'heading',
  H4: 'heading',
  H5: 'heading',
  H6: 'heading',
  LI: 'listitem',
  UL: 'list',
  OL: 'list',
  TABLE: 'table',
  OUTPUT: 'status',
};

const INPUT_ROLES: Record<string, string> = {
  button: 'button',
  submit: 'button',
  reset: 'button',
  checkbox: 'checkbox',
  radio: 'radio',
  range: 'slider',
  search: 'searchbox',
  number: 'spinbutton',
};

/** Roles where Playwright's getByRole name is reliable enough to use. */
const NAMED_ROLES = new Set([
  'button',
  'link',
  'checkbox',
  'radio',
  'tab',
  'menuitem',
  'option',
  'heading',
  'textbox',
  'searchbox',
  'combobox',
  'spinbutton',
  'slider',
  'switch',
  'status',
  'alert',
  'dialog',
  'img',
]);

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/** Escape a value for use inside a double-quoted CSS attribute selector. */
const attr = (v: string) => v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/** Escape an identifier (id) for a CSS selector. Small subset of CSS.escape. */
const ident = (v: string) =>
  v.replace(/[^a-zA-Z0-9_\u00a0-\uffff-]/g, (c) => `\\${c}`).replace(/^(\d)/, '\\3$1 ');

export function roleOf(el: Element): string {
  const explicit = el.getAttribute('role');
  if (explicit) return explicit.split(' ')[0]!;
  if (el.tagName === 'A' && el.hasAttribute('href')) return 'link';
  if (el.tagName === 'IMG' && el.getAttribute('alt')) return 'img';
  if (el.tagName === 'INPUT') {
    const type = (el.getAttribute('type') ?? 'text').toLowerCase();
    return INPUT_ROLES[type] ?? 'textbox';
  }
  return IMPLICIT_ROLES[el.tagName] ?? '';
}

function labelText(el: Element): string {
  const doc = el.ownerDocument;
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    return clean(
      labelledBy
        .split(/\s+/)
        .map((id) => doc.getElementById(id)?.textContent ?? '')
        .join(' '),
    );
  }
  const id = el.getAttribute('id');
  if (id) {
    const label = doc.querySelector(`label[for="${attr(id)}"]`);
    if (label) return clean(label.textContent);
  }
  const wrapping = el.closest('label');
  return wrapping ? clean(wrapping.textContent) : '';
}

/** A simple accessible name: aria-label, label, alt, value or text. */
export function accessibleName(el: Element): string {
  const aria = clean(el.getAttribute('aria-label'));
  if (aria) return aria;
  const label = labelText(el);
  if (label) return label;
  if (el.tagName === 'IMG') return clean(el.getAttribute('alt'));
  if (el.tagName === 'INPUT') {
    const type = (el.getAttribute('type') ?? '').toLowerCase();
    if (['button', 'submit', 'reset'].includes(type)) return clean((el as HTMLInputElement).value);
    return '';
  }
  if (['TEXTAREA', 'SELECT'].includes(el.tagName)) return '';
  const text = clean(el.textContent);
  return text || clean(el.getAttribute('title'));
}

function count(doc: Document, locator: Locator, testIdAttribute: string): number {
  const all = Array.from(doc.body.querySelectorAll('*'));
  switch (locator.kind) {
    case 'testid':
      return doc.querySelectorAll(`[${testIdAttribute}="${attr(locator.value)}"]`).length;
    case 'role':
      return all.filter((e) => roleOf(e) === locator.role && accessibleName(e) === locator.name).length;
    case 'label':
      return all.filter((e) => isLabelable(e) && labelText(e) === locator.value).length;
    case 'placeholder':
      return all.filter((e) => clean(e.getAttribute('placeholder')) === locator.value).length;
    case 'text':
      // Count only the deepest elements that hold the text, like Playwright does.
      return all.filter(
        (e) =>
          clean(e.textContent) === locator.value &&
          !Array.from(e.children).some((c) => clean(c.textContent) === locator.value),
      ).length;
    case 'css':
      return doc.querySelectorAll(locator.value).length;
  }
}

const isLabelable = (el: Element) => ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);

function cssPath(el: Element): string {
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node.tagName !== 'BODY' && node.tagName !== 'HTML') {
    const id = node.getAttribute('id');
    if (id && !/\d{3,}/.test(id)) {
      parts.unshift(`#${ident(id)}`);
      break;
    }
    const tag = node.tagName.toLowerCase();
    const parent: Element | null = node.parentElement;
    const same = parent ? Array.from(parent.children).filter((c) => c.tagName === node!.tagName) : [];
    parts.unshift(same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(node) + 1})` : tag);
    node = parent;
  }
  return parts.join(' > ');
}

/**
 * Click targets are often an icon or span inside the real control.
 * Walk up to the nearest interactive element (or test id) so the locator is meaningful.
 */
export function interactiveAncestor(el: Element, testIdAttribute = 'data-testid'): Element {
  const hit = el.closest(
    `[${testIdAttribute}], button, a[href], input, select, textarea, label, summary, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="option"], [role="checkbox"], [role="switch"]`,
  );
  return hit ?? el;
}

/**
 * Pick the most stable unique locator for an element.
 * Order: test id > role + name > label > placeholder > text > CSS (fragile).
 */
export function pickLocator(el: Element, testIdAttribute = 'data-testid'): Locator {
  const doc = el.ownerDocument;
  const unique = (l: Locator) => count(doc, l, testIdAttribute) === 1;

  const testId = el.getAttribute(testIdAttribute);
  if (testId) {
    const l: Locator = { kind: 'testid', value: testId };
    if (unique(l)) return l;
  }

  const role = roleOf(el);
  const name = accessibleName(el);
  if (role && name && NAMED_ROLES.has(role) && name.length <= 80) {
    const l: Locator = { kind: 'role', role, name };
    if (unique(l)) return l;
  }

  if (isLabelable(el)) {
    const label = labelText(el);
    if (label) {
      const l: Locator = { kind: 'label', value: label };
      if (unique(l)) return l;
    }
  }

  const placeholder = clean(el.getAttribute('placeholder'));
  if (placeholder) {
    const l: Locator = { kind: 'placeholder', value: placeholder };
    if (unique(l)) return l;
  }

  const text = clean(el.textContent);
  if (text && text.length <= 60 && !isLabelable(el)) {
    const l: Locator = { kind: 'text', value: text };
    if (unique(l)) return l;
  }

  return { kind: 'css', value: cssPath(el) };
}

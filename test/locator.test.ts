// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { interactiveAncestor, pickLocator } from '../src/core/locator';

const $ = (sel: string) => document.querySelector(sel)!;

beforeEach(() => {
  document.body.innerHTML = `
    <main>
      <button data-testid="remove-item-2"><span class="icon">x</span></button>
      <button>Save</button>
      <button>Delete</button><button>Delete</button>
      <label for="email">Email</label><input id="email" type="email">
      <label>Phone <input name="phone"></label>
      <input placeholder="Search products">
      <a href="/help">Help center</a>
      <p>Free shipping over ₹999</p>
      <div id="results"><div>One</div><div>Two</div></div>
      <ul><li>A</li><li>A</li></ul>
      <output aria-label="Cart total">₹998</output>
      <img src="x.png" alt="Logo">
      <input type="submit" value="Pay now">
      <div class="card"><div class="card">same</div></div>
      <div class="card"><div class="card">same</div></div>
    </main>`;
});

describe('pickLocator', () => {
  it('prefers test id', () => {
    expect(pickLocator($('[data-testid="remove-item-2"]'))).toEqual({ kind: 'testid', value: 'remove-item-2' });
  });

  it('uses role + name for a unique button', () => {
    expect(pickLocator($('button:nth-of-type(2)'))).toEqual({ kind: 'role', role: 'button', name: 'Save' });
  });

  it('falls back to CSS when role + name is not unique', () => {
    const del = document.querySelectorAll('button')[2]!;
    expect(pickLocator(del).kind).toBe('css');
  });

  it('uses label for inputs (for= and wrapping)', () => {
    expect(pickLocator($('#email'))).toEqual({ kind: 'role', role: 'textbox', name: 'Email' });
    expect(pickLocator($('[name="phone"]'))).toEqual({ kind: 'role', role: 'textbox', name: 'Phone' });
  });

  it('uses placeholder when there is no label', () => {
    expect(pickLocator($('[placeholder]'))).toEqual({ kind: 'placeholder', value: 'Search products' });
  });

  it('handles links, status, images and submit inputs', () => {
    expect(pickLocator($('a'))).toEqual({ kind: 'role', role: 'link', name: 'Help center' });
    expect(pickLocator($('output'))).toEqual({ kind: 'role', role: 'status', name: 'Cart total' });
    expect(pickLocator($('img'))).toEqual({ kind: 'role', role: 'img', name: 'Logo' });
    expect(pickLocator($('[type="submit"]'))).toEqual({ kind: 'role', role: 'button', name: 'Pay now' });
  });

  it('uses text for plain elements', () => {
    expect(pickLocator($('p'))).toEqual({ kind: 'text', value: 'Free shipping over ₹999' });
  });

  it('builds a CSS path from the nearest id', () => {
    expect(pickLocator($('#results > div:nth-of-type(2)'))).toEqual({ kind: 'text', value: 'Two' });
    const items = document.querySelectorAll('li');
    expect(pickLocator(items[1]!)).toEqual({ kind: 'css', value: 'main > ul > li:nth-of-type(2)' });
  });

  it('CSS fallback selector matches exactly the element', () => {
    const el = document.querySelectorAll('.card .card')[1]!;
    const loc = pickLocator(el);
    expect(loc.kind).toBe('css');
    if (loc.kind === 'css') expect(document.querySelector(loc.value)).toBe(el);
  });
});

describe('interactiveAncestor', () => {
  it('walks from an icon to its button', () => {
    expect(interactiveAncestor($('.icon'))).toBe($('[data-testid="remove-item-2"]'));
  });
  it('returns the element itself when nothing interactive is around', () => {
    expect(interactiveAncestor($('p'))).toBe($('p'));
  });
});

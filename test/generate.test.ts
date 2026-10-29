import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generateSpec, prBody, slugify, toPath } from '../src/core/generate';
import type { Recording } from '../src/core/types';

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}/recording.json`, import.meta.url), 'utf8')) as Recording;

describe('generateSpec', () => {
  it.each(['cart-total', 'login-secret', 'fragile-css'])('%s matches expected.spec.ts', async (name) => {
    const { code } = generateSpec(fixture(name), { baseURL: 'http://localhost:3000' });
    await expect(code).toMatchFileSnapshot(`./fixtures/${name}/expected.spec.ts`);
  });

  it('refuses a recording without an expect step', () => {
    const rec = fixture('cart-total');
    rec.steps = rec.steps.filter((s) => s.type !== 'expect');
    expect(() => generateSpec(rec, { baseURL: '' })).toThrow(/Expect/);
  });

  it('never puts a secret value in the code', () => {
    const rec = fixture('login-secret');
    const step = rec.steps[1]!;
    if (step.type === 'fill') step.value = 'hunter2';
    const { code, envVars } = generateSpec(rec, { baseURL: '' });
    expect(code).not.toContain('hunter2');
    expect(envVars).toEqual(['B2T_PASSWORD']);
  });

  it('names the file from the title', () => {
    expect(generateSpec(fixture('cart-total'), { baseURL: '' }).fileName).toBe(
      'cart-total-does-not-update-after-removing-item.spec.ts',
    );
  });
});

describe('helpers', () => {
  it('slugify falls back to "bug"', () => {
    expect(slugify('  !!! ')).toBe('bug');
  });

  it('toPath keeps other origins as full URLs', () => {
    expect(toPath('http://localhost:3000/a?b=1', 'http://localhost:3000')).toBe('/a?b=1');
    expect(toPath('https://other.dev/a', 'http://localhost:3000')).toBe('https://other.dev/a');
  });
});

describe('prBody', () => {
  it('lists steps, console errors and failed requests', () => {
    const body = prBody(fixture('login-secret'), 'tests/bugs/login.spec.ts');
    expect(body).toContain('1. Type "qa@example.com" into Email');
    expect(body).toContain('2. Type $B2T_PASSWORD into Password');
    expect(body).toContain('**Expected** button "Sign in" to be enabled');
    expect(body).toContain("TypeError: Cannot read properties of undefined (reading 'valid')");
    expect(body).toContain('| POST | https://staging.example.com/api/validate | 500 |');
  });
});

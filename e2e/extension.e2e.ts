import { chromium, expect, test, type BrowserContext, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateSpec } from '../src/core/generate';
import type { RecorderState } from '../src/shared/messages';

const DIST = join(import.meta.dirname, '..', 'dist');
const DEMO = 'http://localhost:4173/demo/';

let context: BrowserContext;
let extPage: Page;

test.beforeAll(async () => {
  // Copy the built extension and pre-grant localhost. In real use the popup asks the
  // tester for the site permission, which a test cannot click.
  const ext = mkdtempSync(join(tmpdir(), 'b2t-ext-'));
  cpSync(DIST, ext, { recursive: true });
  const manifest = JSON.parse(readFileSync(join(ext, 'manifest.json'), 'utf8'));
  manifest.host_permissions.push('http://localhost/*');
  writeFileSync(join(ext, 'manifest.json'), JSON.stringify(manifest));

  context = await chromium.launchPersistentContext('', {
    channel: process.env.CHROME_PATH ? undefined : 'chromium',
    executablePath: process.env.CHROME_PATH || undefined,
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const id = new URL(worker.url()).host;
  extPage = await context.newPage();
  await extPage.goto(`chrome-extension://${id}/popup/index.html`);
});

test.afterAll(() => context?.close());

/** Send a message to the background worker, as the popup does. */
const bg = (msg: object) => extPage.evaluate((m) => chrome.runtime.sendMessage(m), msg);
const state = () =>
  extPage.evaluate(async () => (await chrome.storage.local.get('state')).state) as Promise<RecorderState>;

test('records a bug and generates a test that fails until the bug is fixed', async () => {
  const shop = await context.newPage();
  await shop.goto(DEMO);
  const tabId = await extPage.evaluate(
    async (url) => (await chrome.tabs.query({ url: 'http://localhost/*' })).find((t) => t.url === url)?.id,
    DEMO,
  );
  expect(tabId).toBeTruthy();
  await bg({ type: 'start', tabId, url: DEMO });

  // Tester repeats the bug: remove the Notebook (₹499) from a ₹998 cart.
  await shop.bringToFront();
  await shop.getByTestId('add-item-3').click(); // fires a failing /api/cart request
  await shop.getByTestId('remove-item-3').click();
  await shop.getByTestId('remove-item-2').click();
  await expect(shop.locator('#total')).toHaveText('₹2,297'); // the bug: total did not change

  // Tester clicks "Add expect", picks the total, and says it should be ₹499.
  await bg({ type: 'pickExpect' });
  await shop.locator('#total').click();
  const panel = shop.getByRole('dialog', { name: 'Bug2Test expect' });
  await expect(panel).toBeVisible();
  await panel.getByRole('textbox').first().fill('₹499');
  await panel.getByRole('button', { name: 'Add expect' }).click();
  await expect(panel).toBeHidden();

  await expect.poll(async () => (await state()).rec.steps.length).toBe(5);
  await bg({ type: 'stop' });
  await bg({ type: 'update', patch: { title: 'Cart total does not update after removing item' } });

  const { rec } = await state();
  expect(rec.steps).toEqual([
    { type: 'goto', url: DEMO },
    { type: 'click', target: { kind: 'testid', value: 'add-item-3' } },
    { type: 'click', target: { kind: 'testid', value: 'remove-item-3' } },
    { type: 'click', target: { kind: 'testid', value: 'remove-item-2' } },
    {
      type: 'expect',
      target: { kind: 'role', role: 'status', name: 'Cart total' },
      assertion: { kind: 'text', value: '₹499' },
    },
  ]);
  expect(rec.networkFailures).toContainEqual({ method: 'POST', url: 'http://localhost:4173/demo/api/cart', status: 404 });

  // The generated test must fail on the buggy shop and pass on the fixed one.
  const { code, fileName } = generateSpec(rec, { baseURL: 'http://localhost:4173' });
  // Inside the repo so the spec can import @playwright/test.
  const dir = join(import.meta.dirname, '.generated');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, 'tests'), { recursive: true });
  writeFileSync(join(dir, 'tests', fileName), code);
  const run = (baseURL: string): { status: 'passed' | 'failed'; output: string } => {
    writeFileSync(
      join(dir, 'playwright.config.mjs'),
      `export default { testDir: 'tests', timeout: 10000, expect: { timeout: 2000 }, use: { baseURL: '${baseURL}', launchOptions: { executablePath: process.env.CHROME_PATH || undefined } } };`,
    );
    try {
      const out = execFileSync('npx', ['playwright', 'test', '--config', join(dir, 'playwright.config.mjs')], {
        cwd: join(import.meta.dirname, '..'),
        stdio: 'pipe',
      });
      return { status: 'passed', output: String(out) };
    } catch (e) {
      return { status: 'failed', output: String((e as { stdout?: Buffer }).stdout) };
    }
  };
  const buggy = run('http://localhost:4173');
  expect(buggy.status).toBe('failed');
  expect(buggy.output).toContain('toHaveText'); // failed on the assertion, not on setup
  expect(buggy.output).toContain('₹2,297');
  const fixed = run('http://localhost:4174');
  expect(fixed.output).toContain('1 passed');
  expect(fixed.status).toBe('passed');
});

test('never records a typed password, only an env var name', async () => {
  const shop = await context.newPage();
  await shop.goto(DEMO);
  await bg({ type: 'reset' });
  const tabId = await extPage.evaluate(
    async (url) => (await chrome.tabs.query({ url: 'http://localhost/*' })).filter((t) => t.url === url).at(-1)?.id,
    DEMO,
  );
  await bg({ type: 'start', tabId, url: DEMO });
  await shop.bringToFront();
  // Add a password field the way a login form would have one.
  await shop.evaluate(() => {
    const input = Object.assign(document.createElement('input'), { type: 'password', name: 'password' });
    input.setAttribute('aria-label', 'Password');
    document.querySelector('form')!.prepend(input);
  });
  await shop.getByLabel('Password').fill('hunter2');
  await shop.getByLabel('Email').fill('qa@example.com');
  await expect.poll(async () => (await state()).rec.steps.length).toBe(3);
  await bg({ type: 'stop' });

  const { rec } = await state();
  expect(JSON.stringify(rec)).not.toContain('hunter2');
  expect(rec.steps[1]).toEqual({
    type: 'fill',
    target: { kind: 'role', role: 'textbox', name: 'Password' },
    value: '',
    env: 'B2T_PASSWORD',
  });
  expect(rec.steps[2]).toMatchObject({ type: 'fill', value: 'qa@example.com' });
});

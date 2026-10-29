# Bug2Test: MVP plan

**One line:** A Chrome extension: record a bug, mark what was expected, get a PR with a failing Playwright test.

## How it works
1. **Record:** content script listens to `click`, `input`/`change`, `keydown` (Enter, Escape), `submit` and URL changes. Each event becomes a step with a selector and value.
2. **Selectors:** for each target, pick the best locator in this order: `data-testid` > role + accessible name > label > placeholder > text > CSS (flagged as fragile).
3. **Expect:** tester clicks **Expect**, picks an element, and chooses one: has text, is visible, is hidden, is enabled, URL is. This becomes the `expect(...)` that fails on the bug.
4. **Context:** collect console errors and failed `fetch`/XHR (status >= 400) during the recording. Added to the PR body, not the test.
5. **Generate:** turn steps into a `*.spec.ts` using `@playwright/test`. Base URL from repo config, not hard-coded.
6. **PR:** with a fine-grained GitHub token (Contents + Pull requests: write), create branch `bug2test/<slug>`, commit `tests/bugs/<slug>.spec.ts`, open a PR with steps, expected vs actual, and logs.

## Example output
```ts
import { test, expect } from '@playwright/test';

test('bug: cart total does not update after removing item', async ({ page }) => {
  await page.goto('/cart');
  await page.getByTestId('remove-item-2').click();
  await expect(page.getByRole('status', { name: 'Cart total' })).toHaveText('₹499');
});
```

## Repo config (in the target repo, optional)
`bug2test.json`
```json
{
  "baseURL": "http://localhost:3000",
  "testDir": "tests/bugs",
  "testIdAttribute": "data-testid",
  "sensitive": ["password", "otp", "card"]
}
```

## Stack
Chrome MV3, TypeScript, Vite, React (popup + options), vitest, Playwright. GitHub REST via `fetch` (no Octokit, smaller bundle). No AI in the MVP. Optional later: Claude turns the recording into a clean bug title and better assertions.

## Build order (3-4 weeks)
1. `core`: step types, selector picker, spec generator + snapshot tests
2. Content script recorder + Expect picker overlay
3. Popup: start/stop, step list (delete/edit a step), code preview, copy
4. Options page: repo, token, base branch, test dir; GitHub PR flow
5. Demo app (small Next.js shop with 3 planted bugs) + e2e test that loads the extension
6. README GIF, unpacked install guide; Chrome Web Store later

## Later
- Jira / Linear: attach the PR to the ticket, or start from a ticket
- Network mocking from recorded responses
- GitHub Action that runs only `tests/bugs/` and comments on the fix PR

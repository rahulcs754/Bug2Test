# CLAUDE.md

## Project
Bug2Test: a Chrome extension (Manifest V3) that records a bug in the browser and opens a GitHub PR with a failing Playwright test for it. Plan: docs/MVP-PLAN.md. Research: docs/RESEARCH.md.

## Stack
Node 22, TypeScript strict, ESM. Vite build, React for popup/options UI. vitest for unit tests, Playwright for e2e. No AI in the MVP.

## Layout
- `src/core/`: pure logic (events -> selectors -> spec code). No `chrome.*` here, so it is easy to test.
- `src/content/`: content script that listens to the page.
- `src/background/`: service worker, stores the recording, talks to GitHub.
- `src/content/page.ts`: runs in the page world, reports console errors and failed requests.
- `src/popup/`, `src/options/`: React UI. `src/shared/`: message types and storage helpers.
- `site/`: GitHub Pages (landing + demo shop with planted bugs). `e2e/`: loads the real extension.

## Rules
- Selectors: prefer `getByTestId` > `getByRole` + name > `getByLabel` > `getByText`. CSS only as last fallback, and mark it with a `// TODO: fragile selector` comment.
- Never record password fields or inputs marked sensitive. Write `process.env.<NAME>` placeholders instead.
- A test is only useful if it fails on the bug: every generated spec must have at least one `expect`.
- The spec generator has snapshot tests: `events.json` -> `expected.spec.ts`.
- GitHub token lives in `chrome.storage.local` only. Never log it, never send it anywhere but api.github.com.
- Ask for the smallest Chrome permissions possible (`activeTab`, `storage`, `scripting`).

## Commands
- `npm test`, `npm run build`, `npm run dev`, `npm run test:e2e`
- Snapshot files: `test/fixtures/<name>/recording.json` -> `expected.spec.ts`. Update with `npx vitest -u` and review the diff.

## Owner
Senior React/Next.js dev, India. Wants short, simple English and a clean portfolio-grade repo.

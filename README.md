# Bug2Test

A Chrome extension that turns a **bug report into a failing Playwright test**. A tester records the bug in the browser, marks what should have happened, and Bug2Test opens a PR with a test that fails today and passes once the bug is fixed.

> Status: planning. See [docs/MVP-PLAN.md](docs/MVP-PLAN.md).

## Why
- Bug tickets say "click here, then it breaks". Devs spend time just reproducing them.
- Fixed bugs come back because nobody wrote a regression test.
- Tools like Jam capture a replay for humans. Playwright codegen records for devs. Nothing goes from a tester's bug straight to a test in the repo.

## What it will do
- Record clicks, typing and page changes with stable selectors (`getByRole`, `getByTestId`, `getByLabel`)
- Capture console errors and failed network calls as context
- Let the tester click an element and say what was **expected** (text, visible, enabled, URL)
- Generate a readable `*.spec.ts` that fails on the bug
- Open a PR in your repo with the test plus a bug summary

## Planned flow
1. Click **Record** on the page with the bug
2. Do the steps, then click **Expect** and pick the broken element
3. Review the generated test in the popup
4. Click **Open PR** (needs a GitHub fine-grained token for the repo)

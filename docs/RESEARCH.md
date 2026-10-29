# Research notes (Oct 2026)

From round 3 idea research (team workflow tools for QA and testers).

## The problem
- Testers write steps in Jira; devs re-do them to reproduce. Back-and-forth on "can't reproduce" is common.
- Regression tests for fixed bugs are often skipped, so the same bug ships again.
- AI coding tools write more code faster, so QA has more to check and fewer tests are written by hand.

## Nearby tools
- **Jam.dev**: one-click bug report with replay, console and network. Great for humans, does not write a test.
- **Playwright codegen** (`npx playwright codegen`): records actions into code. Dev tool, no expected-result step, no PR.
- **Replay.io / Meticulous**: record sessions or auto-generate visual tests. Heavy setup, paid, not bug-focused.
- **Chrome DevTools Recorder**: exports to Puppeteer/JSON, no assertions on the bug.

**Gap:** a tester-friendly tool that goes from "here is the bug" to "here is a failing test in a PR", with real assertions and readable selectors.

## Risks
- Selector quality decides if the test is useful. Must prefer test ids and roles.
- Auth and test data: recorded flows may need login. MVP: support a `storageState` path or env placeholders, do not record secrets.
- Chrome Web Store review takes time; ship as unpacked extension first.

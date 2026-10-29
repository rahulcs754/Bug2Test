/** How to find an element. Ordered from most to least stable. */
export type Locator =
  | { kind: 'testid'; value: string }
  | { kind: 'role'; role: string; name: string }
  | { kind: 'label'; value: string }
  | { kind: 'placeholder'; value: string }
  | { kind: 'text'; value: string }
  | { kind: 'css'; value: string };

export type Assertion =
  | { kind: 'text'; value: string }
  | { kind: 'visible' }
  | { kind: 'hidden' }
  | { kind: 'enabled' }
  | { kind: 'value'; value: string }
  | { kind: 'url'; value: string };

export type Step =
  | { type: 'goto'; url: string }
  | { type: 'click'; target: Locator }
  | { type: 'fill'; target: Locator; value: string; env?: string }
  | { type: 'select'; target: Locator; value: string }
  | { type: 'check'; target: Locator; checked: boolean }
  | { type: 'press'; target: Locator; key: string }
  | { type: 'expect'; target?: Locator; assertion: Assertion };

export interface NetworkFailure {
  method: string;
  url: string;
  status: number;
}

/** Everything captured while the tester reproduced the bug. */
export interface Recording {
  title: string;
  /** What the tester saw instead of the expected result. */
  actual: string;
  startUrl: string;
  steps: Step[];
  consoleErrors: string[];
  networkFailures: NetworkFailure[];
}

export interface Settings {
  owner: string;
  repo: string;
  baseBranch: string;
  token: string;
  testDir: string;
  /** App URL the tests run against, e.g. http://localhost:3000. Empty = keep full URLs. */
  baseURL: string;
  testIdAttribute: string;
  /** Field name parts that must never be recorded. */
  sensitive: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  owner: '',
  repo: '',
  baseBranch: 'main',
  token: '',
  testDir: 'tests/bugs',
  baseURL: '',
  testIdAttribute: 'data-testid',
  sensitive: ['password', 'passwd', 'otp', 'pin', 'card', 'cvv', 'ssn', 'secret', 'token'],
};

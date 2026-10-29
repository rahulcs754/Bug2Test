import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GitHubError, openPullRequest, toBase64 } from '../src/core/github';

type Recorded = Record<string, { status: number; body: unknown }>;
const recorded = JSON.parse(
  readFileSync(new URL('./fixtures/github-responses.json', import.meta.url), 'utf8'),
) as Recorded;

function fakeFetch(responses: Recorded) {
  const calls: { key: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    const key = `${init.method} ${new URL(url).pathname}`;
    calls.push({ key, init });
    const hit = responses[key] ?? { status: 404, body: { message: 'Not Found' } };
    return new Response(JSON.stringify(hit.body), { status: hit.status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const input = {
  token: 'ghp_test_token',
  owner: 'acme',
  repo: 'shop',
  base: 'main',
  branch: 'bug2test/cart-total',
  path: 'tests/bugs/cart-total.spec.ts',
  content: "expect('₹499')",
  title: 'Cart total',
  body: 'body',
};

describe('openPullRequest', () => {
  it('creates branch, file and PR in order', async () => {
    const { impl, calls } = fakeFetch(recorded);
    const pr = await openPullRequest(input, impl);
    expect(pr).toEqual({ number: 42, url: 'https://github.com/acme/shop/pull/42' });
    expect(calls.map((c) => c.key)).toEqual(Object.keys(recorded));

    const branch = JSON.parse(calls[1]!.init.body as string);
    expect(branch).toEqual({ ref: 'refs/heads/bug2test/cart-total', sha: 'a1b2c3d4' });
    const file = JSON.parse(calls[2]!.init.body as string);
    expect(file.branch).toBe('bug2test/cart-total');
    expect(Buffer.from(file.content, 'base64').toString('utf8')).toBe(input.content);
  });

  it('sends the token only in the Authorization header', async () => {
    const { impl, calls } = fakeFetch(recorded);
    await openPullRequest(input, impl);
    for (const c of calls) {
      expect((c.init.headers as Record<string, string>).Authorization).toBe('Bearer ghp_test_token');
      expect(String(c.init.body ?? '')).not.toContain('ghp_test_token');
    }
  });

  it('gives a clear error on 401 and does not leak the token', async () => {
    const { impl } = fakeFetch({
      'GET /repos/acme/shop/git/ref/heads/main': { status: 401, body: { message: 'Bad credentials' } },
    });
    const err = await openPullRequest(input, impl).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GitHubError);
    expect((err as GitHubError).status).toBe(401);
    expect((err as Error).message).toMatch(/Token is invalid/);
    expect((err as Error).message).not.toContain('ghp_test_token');
  });
});

describe('toBase64', () => {
  it('handles non-Latin text', () => {
    expect(Buffer.from(toBase64('₹ नमस्ते'), 'base64').toString('utf8')).toBe('₹ नमस्ते');
  });
});

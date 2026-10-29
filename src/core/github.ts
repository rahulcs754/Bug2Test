const API = 'https://api.github.com';

export interface PullRequestInput {
  token: string;
  owner: string;
  repo: string;
  base: string;
  branch: string;
  path: string;
  content: string;
  title: string;
  body: string;
}

export interface PullRequestResult {
  url: string;
  number: number;
}

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Base64 for UTF-8 text (btoa alone breaks on non-Latin characters like ₹). */
export function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

const HINTS: Record<number, string> = {
  401: 'Token is invalid or expired. Update it in Bug2Test options.',
  403: 'Token has no access. It needs Contents and Pull requests: Read and write on this repo.',
  404: 'Repo or branch not found, or the token cannot see this repo.',
  422: 'GitHub rejected the request (maybe the branch already exists).',
};

/**
 * Create a branch, commit one file and open a PR, using the GitHub REST API.
 * `fetchImpl` is injectable so tests use recorded responses, not the network.
 */
export async function openPullRequest(
  input: PullRequestInput,
  fetchImpl: typeof fetch = fetch,
): Promise<PullRequestResult> {
  const repoPath = `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}`;

  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetchImpl(`${API}${repoPath}${path}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${input.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      let detail = '';
      try {
        detail = ((await res.json()) as { message?: string }).message ?? '';
      } catch {
        // body was not JSON
      }
      const hint = HINTS[res.status] ?? 'GitHub request failed.';
      throw new GitHubError(`${hint}${detail ? ` (${detail})` : ''}`, res.status);
    }
    return (await res.json()) as T;
  }

  const ref = await call<{ object: { sha: string } }>(
    'GET',
    `/git/ref/heads/${encodeURIComponent(input.base)}`,
  );
  await call('POST', '/git/refs', { ref: `refs/heads/${input.branch}`, sha: ref.object.sha });
  await call('PUT', `/contents/${input.path.split('/').map(encodeURIComponent).join('/')}`, {
    message: `test: add failing test for "${input.title}"`,
    content: toBase64(input.content),
    branch: input.branch,
  });
  const pr = await call<{ html_url: string; number: number }>('POST', '/pulls', {
    title: `Bug: ${input.title}`,
    head: input.branch,
    base: input.base,
    body: input.body,
  });
  return { url: pr.html_url, number: pr.number };
}

/**
 * Runs in the page's own JS world (not the isolated content-script world),
 * so it can see console errors and failed fetch/XHR calls.
 * It only posts small messages to the content script. It never reads request bodies.
 */

type PageEvent =
  | { kind: 'consoleError'; text: string }
  | { kind: 'networkFailure'; method: string; url: string; status: number };

declare global {
  interface Window {
    __bug2testPage?: boolean;
  }
}

const post = (data: PageEvent) => window.postMessage({ __bug2test: true, ...data }, window.location.origin);

const stringify = (v: unknown): string => {
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

/** Drop query strings: they often hold tokens or personal data. */
const safeUrl = (url: string) => {
  try {
    const u = new URL(url, window.location.href);
    return u.origin + u.pathname;
  } catch {
    return url.split('?')[0] ?? url;
  }
};

if (!window.__bug2testPage) {
  window.__bug2testPage = true;

  const origError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    post({ kind: 'consoleError', text: args.map(stringify).join(' ') });
    origError(...args);
  };

  window.addEventListener('error', (e) => post({ kind: 'consoleError', text: stringify(e.error ?? e.message) }));
  window.addEventListener('unhandledrejection', (e) =>
    post({ kind: 'consoleError', text: `Unhandled rejection: ${stringify(e.reason)}` }),
  );

  const origFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const url = input instanceof Request ? input.url : String(input);
    try {
      const res = await origFetch(input, init);
      if (res.status >= 400) post({ kind: 'networkFailure', method, url: safeUrl(url), status: res.status });
      return res;
    } catch (err) {
      post({ kind: 'networkFailure', method, url: safeUrl(url), status: 0 });
      throw err;
    }
  };

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
    this.addEventListener('loadend', () => {
      if (this.status >= 400 || this.status === 0) {
        post({ kind: 'networkFailure', method: method.toUpperCase(), url: safeUrl(String(url)), status: this.status });
      }
    });
    return (origOpen as (...a: unknown[]) => void).call(this, method, url, ...rest);
  } as typeof XMLHttpRequest.prototype.open;
}

export {};

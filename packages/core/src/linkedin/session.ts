// How every request to LinkedIn is made. One place for headers, the CSRF
// token, and the request kinds.
//
// Signed-in requests must run in a www.linkedin.com page context (the
// extension's content script, or the page itself): they are same-origin and
// use the viewer's cookies.

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface SessionOptions {
  fetch?: FetchLike;
  /** Prefix for request paths; set to "https://www.linkedin.com" outside a LinkedIn page. */
  base?: string;
  /** JSESSIONID value; defaults to reading document.cookie. */
  csrf?: string;
}

export interface LinkedInSession {
  /** Internal JSON API (voyager), signed in. Payloads are untyped: parse them. */
  voyager(path: string): Promise<unknown>;
  /** Server-driven UI action (RSC flight stream), signed in. */
  rsc(req: { url: string; body: unknown }): Promise<string>;
  /** A page as the signed-in viewer sees it. */
  html(path: string): Promise<string>;
}

export const VOYAGER_HEADERS = {
  accept: 'application/vnd.linkedin.normalized+json+2.1',
  'x-restli-protocol-version': '2.0.0',
} as const;

export function createSession(opts: SessionOptions = {}): LinkedInSession {
  const f: FetchLike = opts.fetch ?? ((url, init) => fetch(url, init));
  const base = opts.base ?? '';
  const csrf = () => {
    if (opts.csrf != null) return opts.csrf;
    const doc = (globalThis as { document?: { cookie: string } }).document;
    return doc?.cookie.match(/JSESSIONID="?([^";]+)"?/)?.[1] ?? '';
  };
  const ok = async (r: Response) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r;
  };
  return {
    async voyager(path) {
      const r = await ok(await f(base + path, { credentials: 'include', headers: { ...VOYAGER_HEADERS, 'csrf-token': csrf() } }));
      return r.json() as Promise<unknown>;
    },
    async rsc({ url, body }) {
      const r = await ok(
        await f(base + url, {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json', 'csrf-token': csrf(), 'x-li-rsc-stream': 'true' },
          body: JSON.stringify(body),
        }),
      );
      return r.text();
    },
    async html(path) {
      return (await ok(await f(base + path, { credentials: 'include' }))).text();
    },
  };
}

/** What every reader accepts: a ready session, or the options to make one. */
export interface ReaderOptions extends SessionOptions {
  session?: LinkedInSession;
}

export const sessionFrom = (o: ReaderOptions = {}) => o.session ?? createSession(o);

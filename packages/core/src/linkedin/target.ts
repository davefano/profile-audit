// Which profile a LinkedIn URL points at.

import { safeDecode } from './html';

/** The profile slug in a LinkedIn URL (`/in/<slug>`, with an optional locale prefix), or null. */
export function profileSlugFromUrl(url: string | null | undefined): string | null {
  let u: URL;
  try {
    u = new URL(url ?? '');
  } catch {
    return null;
  }
  if (!/(^|\.)linkedin\.com$/.test(u.hostname)) return null;
  return /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?in\/([^/]+)/i.exec(safeDecode(u.pathname))?.[1] ?? null;
}

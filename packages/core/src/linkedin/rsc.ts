// Helpers for LinkedIn's server-driven UI responses (React Server Components
// "flight" streams). These are UI trees, not data, so we read visible text.

import { parseCount } from './html';

/** Visible text nodes (`"children":["…"]`) in document order. */
export function rscTexts(rsc: string): string[] {
  const out: string[] = [];
  for (const m of rsc.matchAll(/"children":\["((?:[^"\\]|\\.)*)"\]/g)) {
    const raw = m[1]!;
    if (raw.startsWith('$')) continue; // references to other rows, not text
    try {
      const s = JSON.parse(`"${raw}"`) as string;
      if (s.trim()) out.push(s);
    } catch {
      // ignore malformed fragments
    }
  }
  return out;
}

/** Distinct post/activity IDs (`urn:li:activity|ugcPost|share:<id>`). */
export function postIds(text: string): string[] {
  return [...new Set([...text.matchAll(/urn:li:(?:activity|ugcPost|share):(\d{15,20})/g)].map((m) => m[1]!))];
}

/** "1,234 followers" / "12K followers" / "500+ connections" → { count, capped }. */
export function parseCountText(text: string, noun: 'connections' | 'followers'): { count: number; capped: boolean } | null {
  const singular = noun.slice(0, -1);
  const m = text.match(new RegExp(`([\\d,.]+[KkMm]?)\\s*(\\+)?\\s*(?:${noun}|${singular})\\b`, 'i'));
  const count = parseCount(m?.[1]);
  return m && count != null ? { count, capped: !!m[2] } : null;
}

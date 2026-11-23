// Small text helpers shared by the parsers.

/** "1,234" / "12K" / "1.2M" → number. */
export function parseCount(s: string | null | undefined): number | null {
  const m = s?.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*([KkMm])?/);
  if (!m) return null;
  const n = Number(m[1]) * (m[2] ? (m[2].toLowerCase() === 'k' ? 1e3 : 1e6) : 1);
  return Math.round(n);
}

/** "…/0/1712065960987?e=…" → upload time in ms (LinkedIn media URLs). */
export function mediaUploadedAt(url: string | null | undefined): number | null {
  const m = url?.match(/\/0\/(\d{12,14})(?:[/?]|$)/);
  return m ? Number(m[1]) : null;
}

/** decodeURIComponent that returns the input instead of throwing on a malformed escape. */
export function safeDecode(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

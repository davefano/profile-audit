// Stable identifiers hidden inside LinkedIn's opaque IDs.

function base64UrlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/**
 * Numeric member ID from a profile ID (`ACoAA…`, the `fsd_profile` key).
 * Bytes 4–7 of the base64url-decoded ID are the member ID as a big-endian
 * uint32. Unlike the slug, the member ID never changes.
 */
export function memberIdFromProfileId(profileId: string | null | undefined): number | null {
  if (!profileId || !/^[A-Za-z0-9_-]{12,}$/.test(profileId)) return null;
  try {
    const bytes = base64UrlDecode(profileId);
    if (bytes.length < 8) return null;
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4);
  } catch {
    return null;
  }
}

/** Creation time (ms) of a post/activity ID: the top 41 bits are a millisecond timestamp. */
export function postTimestampMs(id: string | bigint): number {
  return Number(BigInt(id) >> 22n);
}

/** Pull the profile ID out of an `urn:li:fsd_profile:…` URN. */
export function profileIdFromUrn(urn: unknown): string | null {
  return typeof urn === 'string' ? (urn.match(/^urn:li:fsd_profile:([A-Za-z0-9_-]+)$/)?.[1] ?? null) : null;
}

/** Pull the numeric ID out of an `urn:li:member:<n>` URN. */
export function memberIdFromUrn(urn: unknown): number | null {
  const m = typeof urn === 'string' ? urn.match(/^urn:li:member:(\d+)$/) : null;
  return m ? Number(m[1]) : null;
}

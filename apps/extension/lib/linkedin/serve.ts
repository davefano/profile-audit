// The content-script side of the LinkedIn bridge. Runs on www.linkedin.com, so
// signed-in requests are same-origin and use the viewer's session. Stateless:
// every answer is complete in itself.

import { captureProfile, extractProfileFacts } from '@profile-audit/core/linkedin';
import { errorText, serve, type ErrorResponse } from '@/lib/runtime';
import type { LinkedInMessages, ProfileResult } from './protocol';

// Relative URLs resolve against the page in Chrome but not in every browser's
// content-script context, so make them absolute.
const pageFetch = (input: string, init?: RequestInit) => fetch(input.startsWith('/') ? location.origin + input : input, init);

export function serveLinkedIn() {
  // The panel re-injects this script into tabs that predate the extension; a
  // second listener would run every read twice.
  const g = globalThis as { __profileAuditLinkedInServing?: boolean };
  if (g.__profileAuditLinkedInServing) return;
  g.__profileAuditLinkedInServing = true;

  serve<LinkedInMessages>({
    LI_PROFILE: (msg) => profile(msg.slug, msg.includeActivity),
  });
}

async function profile(slug: string, includeActivity = true): Promise<ProfileResult | ErrorResponse> {
  try {
    const snap = await captureProfile(slug, { fetch: pageFetch, includeActivity });
    const facts = extractProfileFacts(snap, snap.capturedAt);
    if (!facts.memberId) return { error: 'profile_unavailable', message: Object.values(snap.errors)[0] ?? 'Profile not found' };
    return { slug, facts, capturedAt: snap.capturedAt, errors: snap.errors };
  } catch (e) {
    return { error: 'capture_failed', message: errorText(e) };
  }
}

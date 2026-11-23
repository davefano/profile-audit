// Read LinkedIn from any extension context that has the tabs API (background,
// side panel). Signed-in reads go through the user's LinkedIn tab (serve.ts).
//
//   const tab = await activeLinkedInTab();
//   const { facts } = await linkedin.profile(tab.profileSlug, { tab });

import { profileSlugFromUrl } from '@profile-audit/core/linkedin';
import { CodedError, isError, sendToTab } from '@/lib/runtime';
import type { LinkedInMessages, ProfileResult } from './protocol';

export interface LinkedInTab {
  tabId: number;
  url: string;
  /** The profile the tab shows, if any. */
  profileSlug: string | null;
  /** The content script (and so the signed-in session) runs on www.linkedin.com only. */
  signedInReachable: boolean;
}

/** The active tab, if it's on LinkedIn, with the profile it shows. */
export async function activeLinkedInTab(): Promise<LinkedInTab | null> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  let host = '';
  try {
    host = new URL(tab?.url ?? '').hostname;
  } catch {
    return null;
  }
  if (!tab?.id || !/(^|\.)linkedin\.com$/.test(host)) return null;
  return { tabId: tab.id, url: tab.url!, profileSlug: profileSlugFromUrl(tab.url), signedInReachable: host === 'www.linkedin.com' };
}

// Tabs opened before the extension was installed or reloaded have no content
// script yet: inject it and retry once. Only when nothing is listening; any
// other failure (a closed port mid-read) is passed on, not retried.
async function ask<K extends keyof LinkedInMessages>(tabId: number, msg: LinkedInMessages[K]['req']): Promise<LinkedInMessages[K]['res']> {
  try {
    return await sendToTab<LinkedInMessages, K>(tabId, msg);
  } catch (e) {
    if (!/Receiving end does not exist|Could not establish connection/i.test(String(e))) throw e;
    await browser.scripting.executeScript({ target: { tabId }, files: ['/content-scripts/content.js'] });
    return sendToTab<LinkedInMessages, K>(tabId, msg);
  }
}

export const linkedin = {
  /** A profile's facts, read in a signed-in LinkedIn tab (about 6 requests). */
  async profile(slug: string, opts: { tab: LinkedInTab | null; includeActivity?: boolean }): Promise<ProfileResult> {
    if (!opts.tab?.signedInReachable) throw new CodedError('capture_failed', 'Open this profile on www.linkedin.com to audit it.');
    const r = await ask<'LI_PROFILE'>(opts.tab.tabId, { type: 'LI_PROFILE', slug, includeActivity: opts.includeActivity });
    if (isError(r)) throw new CodedError(r.error, r.message);
    return r;
  },
};

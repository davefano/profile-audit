// Captures a RawSnapshot (the raw payloads) for one profile. Signed in, so it
// must run in a www.linkedin.com page context. Makes 9 requests; keep usage to
// one profile at a time. Turn it into facts with extractProfileFacts().

import { aboutRequest, endpoints, profileCardRequest } from '../endpoints';
import { errorText } from '../errors';
import { profileIdFromUrn } from '../ids';
import { sessionFrom, type ReaderOptions } from '../session';
import { parseMutual, resolvedProfile } from './facts';
import { SNAPSHOT_SCHEMA, type RawSnapshot } from './snapshot';

export interface CaptureOptions extends ReaderOptions {
  /** The Activity card is several MB; skip it when you don't need activity. */
  includeActivity?: boolean;
}

export async function captureProfile(slug: string, opts: CaptureOptions = {}): Promise<RawSnapshot> {
  const s = sessionFrom(opts);
  const snap: RawSnapshot = { schema: SNAPSHOT_SCHEMA, capturedAt: Date.now(), slug, profileId: null, payloads: {}, errors: {} };
  const attempt = async <K extends keyof RawSnapshot['payloads']>(key: K, fn: () => Promise<RawSnapshot['payloads'][K]>) => {
    try {
      snap.payloads[key] = await fn();
    } catch (e) {
      snap.errors[key] = errorText(e);
    }
  };

  await attempt('resolve', () => s.voyager(endpoints.resolve(slug)));
  snap.profileId = profileIdFromUrn(resolvedProfile(snap.payloads.resolve)?.entityUrn);

  await attempt('fullProfile', () => s.voyager(endpoints.fullProfile(slug)));
  await attempt('profilePageCounts', async () => {
    const html = await s.html(endpoints.profilePage(slug));
    // The number and the word can sit in separate elements:
    // <p>500+</p></div>…<p>connections</p>. Normalise to "500+ connections".
    const re = />\s*([\d,.]+\+?)\s*(?:<[^>]{0,300}>\s*){0,8}(connections?|followers?)\b|([\d,.]+\+?)\s+(connections?|followers?)\b/g;
    // "Avery and Quinn are mutual connections", "Sam, Lee, and 12 other mutual connections".
    // Names are wrapped in inline tags (<strong>Avery</strong> and <strong>Quinn</strong> …), so
    // take the whole run of text and inline tags, then strip the tags.
    const run = />((?:[^<]|<\/?(?:strong|span|b|em)\b[^>]*>){0,800}?\bmutual connections?)/.exec(html)?.[1];
    snap.payloads.profilePageMutualCount = run ? parseMutual(run.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()) : null;
    return [...new Set([...html.matchAll(re)].map((m) => `${m[1] ?? m[3]} ${m[2] ?? m[4]}`))];
  });

  if (snap.profileId) {
    const profileId = snap.profileId;
    await attempt('followingState', () => s.voyager(endpoints.followingState(profileId)));
    await attempt('about', () => s.rsc(aboutRequest(profileId, slug)));
  } else {
    snap.errors.followingState = snap.errors.about = 'no profileId';
  }
  if (opts.includeActivity !== false) await attempt('activity', () => s.rsc(profileCardRequest('activity', slug)));
  await attempt('aboveActivityCard', () => s.rsc(profileCardRequest('aboveActivity', slug)));
  await attempt('recommendationsCard', () => s.rsc(profileCardRequest('recommendations', slug)));
  await attempt('skillsCard', () => s.rsc(profileCardRequest('skills', slug)));

  return snap;
}

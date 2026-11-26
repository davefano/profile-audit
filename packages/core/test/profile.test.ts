import { describe, expect, test } from 'bun:test';
import { captureProfile, estimateJoinedAt, extractProfileFacts, memberIdFromProfileId, parseAbout, parseCountText, parseMutual, postTimestampMs, rscTexts } from '../src/linkedin';
import { fakeSnapshot, postIdAt, profileIdFor } from './fixtures';

const NOW = Date.UTC(2026, 10, 17);

describe('ids', () => {
  test('member ID round-trips through a profile ID', () => {
    for (const id of [1, 251_749_025, 810_000_000, 4_000_000_000]) {
      expect(memberIdFromProfileId(profileIdFor(id))).toBe(id);
    }
  });

  test('rejects junk profile IDs', () => {
    expect(memberIdFromProfileId('')).toBeNull();
    expect(memberIdFromProfileId('not an id!')).toBeNull();
    expect(memberIdFromProfileId('ACoAA')).toBeNull();
  });

  test('post IDs encode their creation time', () => {
    const t = Date.UTC(2026, 10, 14, 18, 11, 59, 974);
    expect(postTimestampMs(postIdAt(t))).toBe(t);
  });
});

test('estimateJoinedAt interpolates between calibration points', () => {
  expect(new Date(estimateJoinedAt(251_749_025, NOW)!).toISOString().slice(0, 7)).toBe('2013-05');
  expect(estimateJoinedAt(1, NOW)).toBe(Date.UTC(2003, 4, 5)); // member 1 = launch
  expect(estimateJoinedAt(9_000_000_000, NOW)).toBeLessThan(NOW); // never in the future
});

describe('rsc', () => {
  test('rscTexts skips references and decodes escapes', () => {
    const s = '0:["$","p",null,{"children":["$L1"]}]\n1:["$","p",null,{"children":["Alex doesn\\u2019t have any"]}]';
    expect(rscTexts(s)).toEqual(['Alex doesn’t have any']);
  });

  test('parseCountText', () => {
    expect(parseCountText('500+ connections', 'connections')).toEqual({ count: 500, capped: true });
    expect(parseCountText('1 connection', 'connections')).toEqual({ count: 1, capped: false });
    expect(parseCountText('40,830,057 followers', 'followers')).toEqual({ count: 40_830_057, capped: false });
    expect(parseCountText('no numbers here', 'followers')).toBeNull();
  });

  test('parseAbout reads join date and verifications', () => {
    const s = fakeSnapshot({ joinedAt: Date.UTC(2013, 4, 15), verifications: [['Identity', 'Verified by LinkedIn in April 2026']] });
    const a = parseAbout(s.payloads.about!);
    expect(new Date(a.joinedAt!).toISOString().slice(0, 7)).toBe('2013-05');
    expect(a.verifications).toEqual(['Identity: Verified by LinkedIn in April 2026']);
    expect(parseAbout(fakeSnapshot().payloads.about!).verifications).toEqual([]);
  });

  test('mutual connections text', () => {
    expect(parseMutual('Avery and Quinn are mutual connections')).toBe(2);
    expect(parseMutual('Sam, Lee, and 12 other mutual connections')).toBe(14);
    expect(parseMutual('are mutual connections')).toBeNull();
  });
});

describe('extractProfileFacts', () => {
  test('extracts identity, history, counts, and activity', () => {
    const f = extractProfileFacts(fakeSnapshot({ memberId: 700_000_123, postTimes: [Date.UTC(2026, 9, 1), Date.UTC(2026, 5, 1)] }), NOW);
    expect(f.memberId).toBe(700_000_123);
    expect(f.slug).toBe('jordan-sample-0a1b2c');
    expect(f.geoName).toBe('Springfield, United States');
    expect(f.industry).toBe('Software Development');
    expect(f.positions).toEqual([
      { title: 'Software Engineer', company: 'Example Corp', companyId: null, description: null, location: null, employmentType: null, start: { year: 2018, month: 1 }, end: null },
    ]);
    expect(f.photo).toEqual({ present: true, uploadedAt: 1_600_000_000_000 });
    expect(f.background).toEqual({ present: false, uploadedAt: null });
    expect(f.connections).toEqual({ count: 500, capped: true });
    expect(f.followers).toBe(300);
    expect(f.joined?.source).toBe('about');
    expect(f.activity).toEqual({ postCount: 2, newestAt: Date.UTC(2026, 9, 1), oldestAt: Date.UTC(2026, 5, 1) });
  });

  test('reads role descriptions, the banner, and optional sections', () => {
    const f = extractProfileFacts(
      fakeSnapshot({
        positions: [{ title: 'Engineer', company: 'Example Corp', startYear: 2020, companyId: 42, description: 'Led the billing rewrite.' }],
        backgroundUploadedAt: 1_700_000_000_000,
        certifications: 2,
      }),
      NOW,
    );
    expect(f.positions[0]).toMatchObject({ companyId: 42, description: 'Led the billing rewrite.' });
    expect(f.background).toEqual({ present: true, uploadedAt: 1_700_000_000_000 });
    expect(f.sections).toEqual({ certifications: 2, projects: 0, volunteering: 0, honors: 0, organizations: 0, languages: 0, courses: 0, publications: 0 });
  });

  test('reads Featured, received recommendations and endorsements from the profile cards', () => {
    const f = extractProfileFacts(fakeSnapshot({ featured: true, recommendations: { received: 2, given: 3 }, endorsements: [6, 2, 1] }), NOW);
    expect(f).toMatchObject({ featured: true, recommendationsReceived: 2, endorsements: 9 });
    const none = extractProfileFacts(fakeSnapshot({ featured: null, recommendations: null, endorsements: null }), NOW);
    expect(none).toMatchObject({ featured: null, recommendationsReceived: null, endorsements: null });
  });

  test('skips Position entities that are bare references', () => {
    const snap = fakeSnapshot();
    const inc = (snap.payloads.fullProfile as { included: Record<string, unknown>[] }).included;
    inc.push({ $type: 'com.linkedin.voyager.dash.identity.profile.Position', entityUrn: `urn:li:fsd_profilePosition:(${snap.profileId},99)` });
    expect(extractProfileFacts(snap, NOW).positions.map((p) => p.title)).toEqual(['Software Engineer']);
  });

  test('counts every skill from the collection total, not just the ones in the payload', () => {
    expect(extractProfileFacts(fakeSnapshot({ skills: 20, skillsTotal: 39 }), NOW).skillCount).toBe(39);
    expect(extractProfileFacts(fakeSnapshot({ skills: 4 }), NOW).skillCount).toBe(4);
  });

  test('falls back to a member-ID join estimate without the About payload', () => {
    const f = extractProfileFacts(fakeSnapshot({ memberId: 251_749_025, joinedAt: null }), NOW);
    expect(f.joined?.source).toBe('memberId');
    expect(f.about).toBeNull();
  });

  test('survives a snapshot where every request failed', () => {
    const f = extractProfileFacts({ schema: 1, capturedAt: NOW, slug: 'x', profileId: null, payloads: {}, errors: { fullProfile: 'HTTP 500' } }, NOW);
    expect(f.memberId).toBeNull();
    expect(f.profileLoaded).toBe(false);
    expect(f.positions).toEqual([]);
  });

  test('malformed nested payloads parse to empty facts instead of throwing', () => {
    for (const payloads of [
      { resolve: { included: 'x' }, fullProfile: { included: {} } },
      { resolve: { included: [{ entityUrn: 123 }] }, fullProfile: { included: [null, 7, { $type: 'x.identity.profile.Profile', entityUrn: 5, firstName: {} }] } },
    ]) {
      const f = extractProfileFacts({ schema: 1, capturedAt: NOW, slug: 'x', profileId: null, payloads: payloads as any, errors: {} }, NOW);
      expect(f.memberId).toBeNull();
      expect(f.firstName).toBeNull();
    }
  });

  test('uses the requested profile when the payload bundles other people first', () => {
    const f = extractProfileFacts(fakeSnapshot({ strangers: 3 }), NOW);
    expect(f.firstName).toBe('Jordan');
    expect(f.positions.map((p) => p.company)).toEqual(['Example Corp']);
  });
});

test('captureProfile makes the expected requests and assembles a snapshot', async () => {
  const fixture = fakeSnapshot();
  const calls: string[] = [];
  const fakeFetch = (async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${url.split('?')[0]}`);
    const p = fixture.payloads;
    const json = (b: unknown) => new Response(JSON.stringify(b));
    if (url.includes('graphql')) return json(p.resolve);
    if (url.includes('dash/profiles')) return json(p.fullProfile);
    if (url.includes('followingStates')) return json(p.followingState);
    if (url.includes('ProfileVerificationDetailsDialog')) return new Response(p.about);
    if (url.includes('profileCardsActivity')) return new Response(p.activity);
    if (url.includes('profileCardsAboveActivity')) return new Response(p.aboveActivityCard);
    if (url.includes('profileCardsBelowActivityPart2')) return new Response(p.recommendationsCard);
    if (url.includes('profileCardsBelowActivityPart7')) return new Response(p.skillsCard);
    if (url.startsWith('/in/'))
      return new Response(
        // Real markup splits the number from the word.
        '<p class="a">300 followers</p><span>·</span><p class="b">500+</p></div><a href="#"><p class="c">connections</p>',
      );
    return new Response('nope', { status: 404 });
  }) as typeof fetch;

  const snap = await captureProfile('jordan-sample-0a1b2c', { fetch: fakeFetch, csrf: 'ajax:test' });
  expect(snap.errors).toEqual({});
  expect(snap.profileId).toBe(fixture.profileId);
  expect(snap.payloads.profilePageCounts).toEqual(['300 followers', '500+ connections']);
  expect(calls).toHaveLength(9);
  expect(extractProfileFacts(snap, NOW).memberId).toBe(700_000_001);
});

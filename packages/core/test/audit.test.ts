import { describe, expect, test } from 'bun:test';
import { auditProfile, looksAutoSlug, RULES } from '../src/audit';
import { extractProfileFacts } from '../src/linkedin';
import { DAY, fakeSnapshot, type FakeProfile } from './fixtures';

const NOW = Date.UTC(2026, 10, 17);

const ABOUT =
  'I build payment systems that stay up on the busiest day of the year.\n\n' +
  'Over the last eight years I have led teams through two platform migrations, cut checkout latency by 40%, and mentored a dozen engineers into senior roles. '.repeat(3) +
  '\n\nI am looking for staff-level roles where reliability is a product feature.';

const STRONG: FakeProfile = {
  slug: 'jordan-sample',
  headline: 'Staff engineer · payments reliability · I help fintech teams ship checkout that never goes down',
  summary: ABOUT,
  photoUploadedAt: NOW - 400 * DAY,
  backgroundUploadedAt: NOW - 300 * DAY,
  positions: [
    { title: 'Staff Engineer', company: 'Example Corp', startYear: 2022, companyId: 1, description: 'Own the payments platform. Cut failed checkouts by 30% and on-call pages by half across 12 services.' },
    { title: 'Senior Engineer', company: 'Sample Labs', startYear: 2018, endYear: 2022, companyId: 2, description: 'Led the move to event-driven billing for 2M customers; built the team from 3 to 8 engineers and ran its hiring loop.' },
  ],
  skills: 12,
  certifications: 1,
  verifications: [['Identity', 'Verified by LinkedIn in April 2026']],
  postTimes: [NOW - 10 * DAY],
};

const audit = (p: FakeProfile, edit?: (s: ReturnType<typeof fakeSnapshot>) => void) => {
  const snap = fakeSnapshot(p);
  edit?.(snap);
  return auditProfile(extractProfileFacts(snap, NOW), NOW);
};
const status = (r: ReturnType<typeof auditProfile>, id: string) => r.findings.find((f) => f.id === id)?.status;

describe('auditProfile', () => {
  test('a complete profile passes every rule', () => {
    const r = audit(STRONG);
    expect(r.findings.filter((f) => f.status !== 'pass')).toEqual([]);
    expect(r.score).toBe(100);
    expect(r.level).toBe('strong');
  });

  test('a bare profile gets specific, actionable findings', () => {
    const r = audit({ summary: null, photoUploadedAt: null, postTimes: [], connections: '42 connections' });
    const improve = r.findings.filter((f) => f.status === 'improve').map((f) => f.id);
    expect(improve).toEqual(
      expect.arrayContaining(['basics.custom_url', 'photo.present', 'photo.banner', 'headline.not_default', 'headline.length', 'about.present', 'experience.descriptions', 'skills.count', 'activity.recent', 'network.connections']),
    );
    for (const f of r.findings.filter((f) => f.status === 'improve')) expect(f.tip).toBeTruthy();
    expect(r.level).toBe('needs_work');
  });

  test('rules that need a missing part are not checked, and do not move the score', () => {
    const full = audit(STRONG);
    const noAbout = audit(STRONG, (s) => delete s.payloads.about);
    expect(status(noAbout, 'basics.verified')).toBe('not_checked');
    expect(noAbout.score).toBe(full.score);
  });

  test('when the profile record fails, its rules are not checked rather than failed', () => {
    const r = audit(STRONG, (s) => delete s.payloads.fullProfile);
    const profileRules = RULES.filter((x) => x.needs.includes('profile')).map((x) => x.id);
    for (const id of profileRules) expect(status(r, id)).toBe('not_checked');
    expect(r.score).toBe(100); // the rest still pass
  });

  test('nothing checkable gives no score', () => {
    const r = auditProfile(extractProfileFacts({ schema: 1, capturedAt: NOW, slug: 'x', profileId: null, payloads: {}, errors: {} }, NOW), NOW);
    expect(r.score).toBeNull();
    expect(r.level).toBeNull();
  });

  test('rules that do not apply are left out', () => {
    // No headline: the length and job-title rules have nothing to judge.
    const r = audit({ ...STRONG, headline: '' });
    expect(status(r, 'headline.present')).toBe('improve');
    expect(status(r, 'headline.length')).toBeUndefined();
    expect(status(r, 'headline.not_default')).toBeUndefined();
  });

  test('the headline rule catches "<title> at <company>" for a current role only', () => {
    expect(status(audit({ ...STRONG, headline: 'staff engineer at example corp' }), 'headline.not_default')).toBe('improve');
    expect(status(audit({ ...STRONG, headline: 'Senior Engineer at Sample Labs' }), 'headline.not_default')).toBe('pass');
  });

  test('an old photo is a suggestion', () => {
    expect(status(audit({ ...STRONG, photoUploadedAt: NOW - 6 * 365 * DAY }), 'photo.recent')).toBe('improve');
  });
});

test('rule ids are unique', () => {
  const ids = RULES.map((r) => r.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test.each([
  ['jordan-sample-0a1b2c', true],
  ['jordan-sample-123456789', true],
  ['jordan-sample', false],
  ['jordan-sample-2024', false],
  ['the-decade', false],
])('looksAutoSlug(%s) = %p', (slug, auto) => {
  expect(looksAutoSlug(slug)).toBe(auto);
});

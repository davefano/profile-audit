import { describe, expect, test } from 'bun:test';
import { auditProfile, looksAutoSlug, RULES } from '../src/audit';
import { extractProfileFacts } from '../src/linkedin';
import { DAY, fakeSnapshot, type FakeProfile } from './fixtures';

const NOW = Date.UTC(2026, 10, 17);

const ABOUT =
  'I build payment systems that stay up on the busiest day of the year: 99.99% uptime across 3 Black Fridays.\n\n' +
  'Over the last eight years I have led teams through two platform migrations and mentored a dozen engineers into senior roles. '.repeat(3) +
  '\n\nI want staff-level roles where reliability is a product feature.';

const bullets = (...lines: string[]) => lines.map((l) => `• ${l}`).join('\n');

const STRONG: FakeProfile = {
  slug: 'jordan-sample',
  headline: 'Staff engineer · payments reliability · I help fintech teams ship checkout that never goes down · 99.99% uptime through 3 Black Fridays · Kafka, Go, Postgres · mentor to engineers growing into senior roles',
  summary: ABOUT,
  photoUploadedAt: NOW - 400 * DAY,
  backgroundUploadedAt: NOW - 300 * DAY,
  positions: [
    { title: 'Staff Engineer', company: 'Example Corp', startYear: 2022, companyId: 1, description: bullets('Own the payments platform across 12 services.', 'Cut failed checkouts by 30%.', 'Halved on-call pages.') },
    { title: 'Senior Engineer', company: 'Sample Labs', startYear: 2018, endYear: 2022, companyId: 2, description: bullets('Led the move to event-driven billing for 2M customers.', 'Grew the team from 3 to 8 engineers.', 'Ran its hiring loop.') },
  ],
  skills: 20,
  skillsTotal: 34,
  certifications: 1,
  projects: 1,
  languages: 2,
  volunteering: 1,
  verifications: [['Identity', 'Verified by LinkedIn in April 2026']],
  postTimes: [NOW - 10 * DAY],
  featured: true,
  recommendations: { received: 2 },
  endorsements: [6, 2],
};

const audit = (p: FakeProfile, edit?: (s: ReturnType<typeof fakeSnapshot>) => void) => {
  const snap = fakeSnapshot(p);
  edit?.(snap);
  return auditProfile(extractProfileFacts(snap, NOW), NOW);
};
const status = (r: ReturnType<typeof auditProfile>, id: string) => r.findings.find((f) => f.id === id)?.status;

describe('auditProfile', () => {
  test('a complete profile passes every rule and stands out', () => {
    const r = audit(STRONG);
    expect(r.findings.filter((f) => f.status !== 'pass')).toEqual([]);
    expect(r.score).toBe(100);
    expect(r.level).toBe('standout');
  });

  test('bonus rules stay out of the score; missing them only keeps a profile from standing out', () => {
    const r = audit({ ...STRONG, projects: 0, languages: 0 });
    expect(status(r, 'extras.sections')).toBe('improve');
    expect(r.score).toBe(100);
    expect(r.level).toBe('strong');
  });

  test('a bare profile gets specific, actionable findings', () => {
    const r = audit({ summary: null, photoUploadedAt: null, postTimes: [], connections: '42 connections' });
    const improve = r.findings.filter((f) => f.status === 'improve').map((f) => f.id);
    expect(improve).toEqual(
      expect.arrayContaining(['basics.custom_url', 'photo.present', 'photo.banner', 'headline.not_default', 'headline.length', 'about.present', 'experience.descriptions', 'experience.company_pages', 'skills.count', 'activity.recent', 'network.connections', 'extras.sections', 'extras.recommendations', 'extras.featured']),
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
    expect(r.level).toBe('strong'); // no bonus rule could be checked, so it can't stand out
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

  test('a headline that asks for a job is a suggestion', () => {
    for (const h of ['Aspiring product manager', 'Seeking new opportunities in fintech', 'Marketing lead | Open to work', 'Looking for my next role'])
      expect(status(audit({ ...STRONG, headline: h }), 'headline.no_asks')).toBe('improve');
    expect(status(audit(STRONG), 'headline.no_asks')).toBe('pass');
  });

  test('a short headline is a suggestion; one near the 220 limit passes', () => {
    expect(status(audit({ ...STRONG, headline: 'Staff engineer · payments reliability' }), 'headline.length')).toBe('improve');
  });

  test('About needs a number in its opening lines, before "see more"', () => {
    const late = 'I build payment systems.\n\nI care about reliability.\n\nI mentor engineers.\n\nI cut checkout latency by 40%.';
    expect(status(audit({ ...STRONG, summary: late }), 'about.metrics_up_front')).toBe('improve');
    expect(status(audit(STRONG), 'about.metrics_up_front')).toBe('pass');
  });

  test('About paragraphs count even when the API has run them together', () => {
    const joined = 'I build payment systems that stay up on the busiest day of the year.I have led teams through two platform migrations. '.repeat(3);
    expect(status(audit({ ...STRONG, summary: joined }), 'about.paragraphs')).toBe('pass');
    expect(status(audit({ ...STRONG, summary: 'I build payment systems that stay up. '.repeat(10) }), 'about.paragraphs')).toBe('improve');
  });

  test('every role needs bullets and a company page', () => {
    const prose = { title: 'Engineer', company: 'Side Gig', startYear: 2015, endYear: 2018, description: 'Built and ran the billing system for a small online store, from the first line of code to the on-call rota.' };
    const r = audit({ ...STRONG, positions: [...STRONG.positions!, prose] });
    expect(status(r, 'experience.bullets')).toBe('improve');
    expect(status(r, 'experience.company_pages')).toBe('improve');
    expect(r.findings.find((f) => f.id === 'experience.bullets')?.detail).toContain('Engineer');
  });

  test('skills count the full total, not the subset in the payload', () => {
    expect(status(audit({ ...STRONG, skills: 20, skillsTotal: 34 }), 'skills.count')).toBe('pass');
    expect(status(audit({ ...STRONG, skills: 20, skillsTotal: 25 }), 'skills.count')).toBe('improve');
  });

  test('recommendations or endorsements, either one, pass the bonus', () => {
    expect(status(audit({ ...STRONG, recommendations: { received: 0, given: 3 }, endorsements: [] }), 'extras.recommendations')).toBe('improve');
    expect(status(audit({ ...STRONG, recommendations: { received: 0 }, endorsements: [1] }), 'extras.recommendations')).toBe('pass');
    expect(status(audit({ ...STRONG, recommendations: null }), 'extras.recommendations')).toBe('not_checked');
  });

  test('no Featured section keeps a strong profile from standing out', () => {
    const r = audit({ ...STRONG, featured: false });
    expect(status(r, 'extras.featured')).toBe('improve');
    expect(r.level).toBe('strong');
  });

  test('activity must be within 30 days', () => {
    expect(status(audit({ ...STRONG, postTimes: [NOW - 45 * DAY] }), 'activity.recent')).toBe('improve');
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

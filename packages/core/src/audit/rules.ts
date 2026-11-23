// The deterministic audit rules. Each reads ProfileFacts and says what it saw.
// Add a rule here and it runs; keep ids stable once shipped.
//
// Thresholds are rules of thumb, not LinkedIn requirements. LinkedIn's own
// limits are noted where a rule uses one.

import type { Position, ProfileFacts, YearMonth } from '../linkedin/profile/facts';
import type { Check, Rule } from './types';

const DAY = 86_400_000;
const YEAR = 365.25 * DAY;

/** LinkedIn's limits. */
export const HEADLINE_MAX = 220;
export const ABOUT_MAX = 2600;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const ms = (d: YearMonth) => Date.UTC(d.year, (d.month ?? 1) - 1, 15);
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** Roles newest first; undated roles last. */
function byRecency(positions: Position[]): Position[] {
  return [...positions].sort((a, b) => (b.start ? ms(b.start) : -Infinity) - (a.start ? ms(a.start) : -Infinity));
}

const current = (f: ProfileFacts) => f.positions.filter((p) => p.start && !p.end);

/**
 * Slugs LinkedIn generates: a name followed by a hex or numeric tail
 * ("jordan-sample-0a1b2c3d", "jordan-sample-123456789"). The tail must contain
 * a digit so words made of a–f letters ("decade") don't count.
 */
export function looksAutoSlug(slug: string): boolean {
  return /-(?=[0-9a-f]*\d)[0-9a-f]{6,}$/i.test(slug) || /-\d{5,}$/.test(slug);
}

const pass = (detail: string): Check => ({ pass: true, detail });
const improve = (detail: string, tip: string): Check => ({ pass: false, detail, tip });

export const RULES: Rule[] = [
  // --- basics ---
  {
    id: 'basics.custom_url',
    section: 'basics',
    weight: 1,
    title: 'Custom profile URL',
    needs: ['profile'],
    check: (f) => {
      if (!f.slug) return null;
      return looksAutoSlug(f.slug)
        ? improve(`Your URL ends in a generated code (/in/${f.slug}).`, 'Set a custom URL under "Edit public profile & URL" so it reads cleanly on a résumé or card.')
        : pass(`Your URL is /in/${f.slug}.`);
    },
  },
  {
    id: 'basics.location',
    section: 'basics',
    weight: 1,
    title: 'Location',
    needs: ['profile'],
    check: (f) =>
      f.geoName ? pass(`Location: ${f.geoName}.`) : improve('No location is set.', 'Add your city or region; recruiters filter searches by location.'),
  },
  {
    id: 'basics.industry',
    section: 'basics',
    weight: 1,
    title: 'Industry',
    needs: ['profile'],
    check: (f) => (f.industry ? pass(`Industry: ${f.industry}.`) : improve('No industry is set.', 'Pick the industry you work in, or want to work in.')),
  },
  {
    id: 'basics.verified',
    section: 'basics',
    weight: 1,
    title: 'Verification',
    needs: ['about'],
    check: (f) => {
      const v = f.about!.verifications;
      return v.length
        ? pass(`${plural(v.length, 'verification')}: ${v.join('; ')}.`)
        : improve('No verifications show on your profile.', 'Verify your identity or your work email in LinkedIn\'s "Verifications" settings; it shows a badge to visitors.');
    },
  },

  // --- photo ---
  {
    id: 'photo.present',
    section: 'photo',
    weight: 3,
    title: 'Profile photo',
    needs: ['profile'],
    check: (f) =>
      f.photo?.present ? pass('You have a profile photo.') : improve('There is no profile photo.', 'Add a clear, recent photo of your face. Profiles without one get far fewer visits.'),
  },
  {
    id: 'photo.recent',
    section: 'photo',
    weight: 1,
    title: 'Photo is recent',
    needs: ['profile'],
    check: (f, now) => {
      const at = f.photo?.present ? f.photo.uploadedAt : null;
      if (!at) return null;
      const years = Math.floor((now - at) / YEAR);
      return years >= 5
        ? improve(`Your photo was uploaded about ${plural(years, 'year')} ago.`, 'Consider a newer photo so people recognise you when you meet.')
        : pass(years < 1 ? 'Your photo was uploaded in the last year.' : `Your photo was uploaded about ${plural(years, 'year')} ago.`);
    },
  },
  {
    id: 'photo.banner',
    section: 'photo',
    weight: 2,
    title: 'Background banner',
    needs: ['profile'],
    check: (f) =>
      f.background?.present
        ? pass('You have a custom background banner.')
        : improve('You are using the default background.', 'Add a banner that says something about your work: a product, a talk, your city, or a simple branded image.'),
  },

  // --- headline ---
  {
    id: 'headline.present',
    section: 'headline',
    weight: 3,
    title: 'Headline',
    needs: ['profile'],
    check: (f) => (f.headline?.trim() ? pass(`"${f.headline.trim()}"`) : improve('There is no headline.', 'Write a headline: what you do and who you do it for.')),
  },
  {
    id: 'headline.not_default',
    section: 'headline',
    weight: 2,
    title: 'Headline says more than your job title',
    needs: ['profile'],
    check: (f) => {
      const h = f.headline?.trim();
      if (!h) return null;
      const isTitle = current(f).some(
        (p) => p.title && (norm(h) === norm(p.title) || (p.company && norm(h) === norm(`${p.title} at ${p.company}`))),
      );
      return isTitle
        ? improve('Your headline is just your current job title.', 'Add what you specialise in or the results you deliver, e.g. "Backend engineer · payments and reliability".')
        : pass('Your headline goes beyond your job title.');
    },
  },
  {
    id: 'headline.length',
    section: 'headline',
    weight: 1,
    title: 'Headline uses the space',
    needs: ['profile'],
    check: (f) => {
      const n = f.headline?.trim().length ?? 0;
      if (!n) return null;
      return n < 50
        ? improve(`Your headline is ${plural(n, 'character')}.`, `You have up to ${HEADLINE_MAX}. Add the keywords people would search to find someone like you.`)
        : pass(`Your headline is ${plural(n, 'character')} of ${HEADLINE_MAX}.`);
    },
  },

  // --- about ---
  {
    id: 'about.present',
    section: 'about',
    weight: 3,
    title: 'About section',
    needs: ['profile'],
    check: (f) =>
      f.summary?.trim() ? pass('You have an About section.') : improve('There is no About section.', 'Write a few short paragraphs: what you do, what you are good at, and what you want next.'),
  },
  {
    id: 'about.length',
    section: 'about',
    weight: 2,
    title: 'About has substance',
    needs: ['profile'],
    check: (f) => {
      const n = f.summary?.trim().length ?? 0;
      if (!n) return null;
      return n < 600
        ? improve(`Your About section is ${plural(n, 'character')}.`, `Aim for 600 or more (the limit is ${ABOUT_MAX}). Add a concrete achievement or two.`)
        : pass(`Your About section is ${plural(n, 'character')} of ${ABOUT_MAX}.`);
    },
  },
  {
    id: 'about.paragraphs',
    section: 'about',
    weight: 1,
    title: 'About is easy to scan',
    needs: ['profile'],
    check: (f) => {
      const s = f.summary?.trim() ?? '';
      if (s.length < 600) return null;
      return /\n/.test(s)
        ? pass('Your About section is broken into paragraphs.')
        : improve('Your About section is one block of text.', 'Break it into short paragraphs or a list so it reads on a phone.');
    },
  },

  // --- experience ---
  {
    id: 'experience.present',
    section: 'experience',
    weight: 3,
    title: 'Experience listed',
    needs: ['profile'],
    check: (f) =>
      f.positions.length
        ? pass(`${plural(f.positions.length, 'role')} listed.`)
        : improve('No experience is listed.', 'Add your roles, including internships, freelance and volunteer work if you are early in your career.'),
  },
  {
    id: 'experience.current',
    section: 'experience',
    weight: 2,
    title: 'Current role',
    needs: ['profile'],
    check: (f) => {
      if (!f.positions.length) return null;
      const now = current(f);
      return now.length
        ? pass(`Current: ${now.map((p) => [p.title, p.company].filter(Boolean).join(' at ')).join('; ')}.`)
        : improve('No role is marked as current.', 'If you are working, mark the role as current. If you are between roles, say what you are looking for in your headline or About section.');
    },
  },
  {
    id: 'experience.descriptions',
    section: 'experience',
    weight: 2,
    title: 'Recent roles are described',
    needs: ['profile'],
    check: (f) => {
      const recent = byRecency(f.positions).slice(0, 3);
      if (!recent.length) return null;
      const thin = recent.filter((p) => (p.description?.trim().length ?? 0) < 100);
      return thin.length
        ? improve(
            `${plural(thin.length, 'recent role')} ${thin.length === 1 ? 'has' : 'have'} little or no description: ${thin.map((p) => p.title ?? 'untitled').join(', ')}.`,
            'Add two to four lines per role: what you owned and what changed because of you.',
          )
        : pass('Your recent roles all have descriptions.');
    },
  },
  {
    id: 'experience.results',
    section: 'experience',
    weight: 1,
    title: 'Results are quantified',
    needs: ['profile'],
    check: (f) => {
      const text = byRecency(f.positions)
        .slice(0, 3)
        .map((p) => p.description ?? '')
        .join('\n');
      if (!text.trim()) return null;
      return /\d/.test(text)
        ? pass('Your recent role descriptions include numbers.')
        : improve('Your recent role descriptions have no numbers.', 'Where you can, size your impact: users, revenue, time saved, team size, percentages.');
    },
  },
  {
    id: 'experience.company_pages',
    section: 'experience',
    weight: 1,
    title: 'Roles link to company pages',
    needs: ['profile'],
    check: (f) => {
      const recent = byRecency(f.positions).slice(0, 3);
      if (!recent.length) return null;
      const unlinked = recent.filter((p) => !p.companyId);
      return unlinked.length
        ? improve(
            `${plural(unlinked.length, 'recent role')} ${unlinked.length === 1 ? "isn't" : "aren't"} linked to a company page: ${unlinked.map((p) => p.company ?? 'unnamed').join(', ')}.`,
            'Edit the role and pick the company from the suggestions so its logo and page link appear.',
          )
        : pass('Your recent roles link to their company pages.');
    },
  },
  {
    id: 'experience.extras',
    section: 'experience',
    weight: 1,
    title: 'Certifications, projects or volunteering',
    needs: ['profile'],
    check: (f) => {
      const s = f.sections;
      const parts = [
        [s.certifications, 'certification'],
        [s.projects, 'project'],
        [s.volunteering, 'volunteer role'],
        [s.honors, 'honor'],
        [s.organizations, 'organization'],
      ] as const;
      const have = parts.filter(([n]) => n > 0).map(([n, w]) => plural(n, w));
      return have.length
        ? pass(`You list ${have.join(', ')}.`)
        : improve('No certifications, projects, volunteering or honors are listed.', 'Add any that are relevant; they give people more reasons to trust your experience.');
    },
  },

  // --- education ---
  {
    id: 'education.present',
    section: 'education',
    weight: 1,
    title: 'Education',
    needs: ['profile'],
    check: (f) =>
      f.educations.length
        ? pass(`${plural(f.educations.length, 'school')} listed.`)
        : improve('No education is listed.', 'Add schools, bootcamps or long-form courses; alumni search uses them.'),
  },

  // --- skills ---
  {
    id: 'skills.count',
    section: 'skills',
    weight: 2,
    title: 'Skills',
    needs: ['profile'],
    check: (f) => {
      // LinkedIn returns a subset of skills, so a count at or above the bar is a pass.
      const n = f.skills.length;
      return n >= 5
        ? pass(`At least ${plural(n, 'skill')} listed.`)
        : improve(n ? `Only ${plural(n, 'skill')} listed.` : 'No skills are listed.', 'Add the skills you want to be found for; you can list up to 100.');
    },
  },

  // --- activity ---
  {
    id: 'activity.recent',
    section: 'activity',
    weight: 2,
    title: 'Recent activity',
    needs: ['activity'],
    check: (f, now) => {
      const newest = f.activity!.newestAt;
      if (!newest) return improve('No posts or comments show in your activity.', 'Share or comment on something in your field now and then; it keeps your profile in front of your network.');
      const days = Math.max(0, Math.floor((now - newest) / DAY));
      return days > 90
        ? improve(`Your latest activity is ${plural(days, 'day')} old.`, 'Post or comment at least once a month or so.')
        : pass(`Your latest activity is ${days ? `${plural(days, 'day')} old` : 'from today'}.`);
    },
  },

  // --- network ---
  {
    id: 'network.connections',
    section: 'network',
    weight: 1,
    title: 'Connections',
    needs: ['connections'],
    check: (f) => {
      const c = f.connections!;
      return c.count >= 500
        ? pass(`${c.count}${c.capped ? '+' : ''} connections.`)
        : improve(`${plural(c.count, 'connection')}.`, 'Connect with people you have worked or studied with; 500 is where LinkedIn stops showing the exact count.');
    },
  },
];

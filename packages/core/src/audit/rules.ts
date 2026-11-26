// The deterministic audit rules. Each reads ProfileFacts and says what it saw.
// Add a rule here and it runs; keep ids stable once shipped. docs/rubric.md
// lists them as a reviewer would, core and bonus.
//
// Thresholds are rules of thumb, not LinkedIn requirements. LinkedIn's own
// limits are noted where a rule uses one.

import type { ProfileFacts } from '../linkedin/profile/facts';
import type { Check, Rule } from './types';

const DAY = 86_400_000;
const YEAR = 365.25 * DAY;

/** LinkedIn's limits. */
export const HEADLINE_MAX = 220;
export const ABOUT_MAX = 2600;

/** Rules of thumb. */
export const HEADLINE_FULL = 160;
export const SKILLS_MIN = 30;
export const CONNECTIONS_MIN = 500;
export const ACTIVITY_DAYS = 30;
/** Roughly what the About section shows before "see more". */
export const ABOUT_OPENING = 300;

/** Words that make a headline read as asking for a job instead of saying what you offer. */
const ASKING = /\b(aspiring|seeking|looking for|actively looking|open to (?:work|new|opportunit\w*|roles?)|job ?seeker|in transition|between (?:jobs|roles)|unemployed|available (?:for|immediately|now)|hire me|exploring (?:new )?opportunit\w*)\b/i;

/** A line that starts like a list item: a bullet character, a dash, or "1." / "1)". */
const BULLET_LINE = /^\s*(?:[•·▪‣◦●○■□✓✔➤►→*+]|[-–—](?=\s)|\d{1,2}[.)](?=\s))/;
const hasBullets = (text: string | null) => (text ?? '').split('\n').filter((l) => BULLET_LINE.test(l)).length >= 2;

/**
 * The About section's lines. LinkedIn's profile API drops the line breaks from
 * the summary ("…and technology.I increased…"; role descriptions keep theirs),
 * so a sentence end followed straight by a capital letter counts as a break too.
 */
export function aboutLines(summary: string): string[] {
  return summary
    .replace(/([.!?])(?=\p{Lu})/gu, '$1\n')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** The first lines of the About section, as far as shows before "see more". */
export function aboutOpening(summary: string): string {
  return aboutLines(summary).slice(0, 3).join('\n').slice(0, ABOUT_OPENING);
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

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
    weight: 2,
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
    id: 'headline.length',
    section: 'headline',
    weight: 2,
    title: 'Headline uses the full length',
    needs: ['profile'],
    check: (f) => {
      const n = f.headline?.trim().length ?? 0;
      if (!n) return null;
      return n < HEADLINE_FULL
        ? improve(
            `Your headline is ${plural(n, 'character')} of ${HEADLINE_MAX}.`,
            `Use most of the ${HEADLINE_MAX}: add your specialty, the results you deliver, and the keywords people search to find someone like you.`,
          )
        : pass(`Your headline is ${plural(n, 'character')} of ${HEADLINE_MAX}.`);
    },
  },
  {
    id: 'headline.no_asks',
    section: 'headline',
    weight: 2,
    title: 'Headline says what you offer',
    needs: ['profile'],
    check: (f) => {
      const h = f.headline?.trim();
      if (!h) return null;
      const ask = ASKING.exec(h)?.[0];
      return ask
        ? improve(
            `Your headline says "${ask}".`,
            'Lead with what you do and the results you bring instead of what you are looking for. "Aspiring" and "seeking" read as asking; the Open to Work setting can carry that message.',
          )
        : pass('Your headline says what you do, not what you are looking for.');
    },
  },
  {
    id: 'headline.not_default',
    section: 'headline',
    weight: 1,
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

  // --- about ---
  {
    id: 'about.present',
    section: 'about',
    weight: 3,
    title: 'About section',
    needs: ['profile'],
    check: (f) =>
      f.summary?.trim() ? pass('You have an About section.') : improve('There is no About section.', 'Write a short, punchy summary: what you do, the results you have delivered, and what you want next.'),
  },
  {
    id: 'about.metrics_up_front',
    section: 'about',
    weight: 2,
    title: 'About leads with results',
    needs: ['profile'],
    check: (f) => {
      const s = f.summary?.trim();
      if (!s) return null;
      return /\d/.test(aboutOpening(s))
        ? pass('Your About section has numbers in its opening lines, before "see more".')
        : improve(
            'The opening lines of your About section, before "see more", have no numbers.',
            'Put one or two measured results in the first three lines, e.g. "Grew signups 40% in a year". Most visitors never click "see more".',
          );
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
      if (s.length < ABOUT_OPENING) return null;
      return aboutLines(s).length > 1
        ? pass('Your About section is broken into short paragraphs.')
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
        : improve('No role is marked as current.', 'If you are working, mark the role as current. If you are between roles, say what you do best in your headline and About section.');
    },
  },
  {
    id: 'experience.descriptions',
    section: 'experience',
    weight: 2,
    title: 'Every role is filled out',
    needs: ['profile'],
    check: (f) => {
      if (!f.positions.length) return null;
      const thin = f.positions.filter((p) => (p.description?.trim().length ?? 0) < 100);
      return thin.length
        ? improve(
            `${plural(thin.length, 'role')} ${thin.length === 1 ? 'has' : 'have'} little or no description: ${thin.map((p) => p.title ?? 'untitled').join(', ')}.`,
            'Describe every role: what you owned and what changed because of you.',
          )
        : pass(`All ${plural(f.positions.length, 'role')} have descriptions.`);
    },
  },
  {
    id: 'experience.bullets',
    section: 'experience',
    weight: 2,
    title: 'Roles use bullet points',
    needs: ['profile'],
    check: (f) => {
      const described = f.positions.filter((p) => p.description?.trim());
      if (!described.length) return null;
      const prose = described.filter((p) => !hasBullets(p.description));
      return prose.length
        ? improve(
            `${plural(prose.length, 'role')} ${prose.length === 1 ? "isn't" : "aren't"} written as bullet points: ${prose.map((p) => p.title ?? 'untitled').join(', ')}.`,
            'Write each role as three to five bullets, one result per line, starting with "•".',
          )
        : pass('Your role descriptions use bullet points.');
    },
  },
  {
    id: 'experience.results',
    section: 'experience',
    weight: 1,
    title: 'Results are quantified',
    needs: ['profile'],
    check: (f) => {
      const text = f.positions.map((p) => p.description ?? '').join('\n');
      if (!text.trim()) return null;
      return /\d/.test(text)
        ? pass('Your role descriptions include numbers.')
        : improve('Your role descriptions have no numbers.', 'Where you can, size your impact: users, revenue, time saved, team size, percentages.');
    },
  },
  {
    id: 'experience.company_pages',
    section: 'experience',
    weight: 2,
    title: 'Roles link to company pages',
    needs: ['profile'],
    check: (f) => {
      if (!f.positions.length) return null;
      const unlinked = f.positions.filter((p) => !p.companyId);
      return unlinked.length
        ? improve(
            `${plural(unlinked.length, 'role')} ${unlinked.length === 1 ? "isn't" : "aren't"} linked to a company page, so no logo shows: ${unlinked.map((p) => p.company ?? 'unnamed').join(', ')}.`,
            'Edit the role and pick the company from the suggestions so its logo and page link appear.',
          )
        : pass('Every role links to its company page.');
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
    title: `${SKILLS_MIN} or more skills`,
    needs: ['profile'],
    check: (f) => {
      const n = f.skillCount;
      return n >= SKILLS_MIN
        ? pass(`${plural(n, 'skill')} listed.`)
        : improve(
            n ? `${plural(n, 'skill')} listed.` : 'No skills are listed.',
            `Add skills until you have at least ${SKILLS_MIN}; each one is a search term you can be found by. You can list up to 100.`,
          );
    },
  },

  // --- activity ---
  {
    id: 'activity.recent',
    section: 'activity',
    weight: 2,
    title: `Active in the last ${ACTIVITY_DAYS} days`,
    needs: ['activity'],
    check: (f, now) => {
      const newest = f.activity!.newestAt;
      const tip = 'Post, comment or react at least a few times a month. You don\'t have to write posts; comments count.';
      if (!newest) return improve('No activity shows on your profile.', tip);
      const days = Math.max(0, Math.floor((now - newest) / DAY));
      return days > ACTIVITY_DAYS
        ? improve(`Your latest activity is ${plural(days, 'day')} old.`, tip)
        : pass(`Your latest activity is ${days ? `${plural(days, 'day')} old` : 'from today'}.`);
    },
  },

  // --- network ---
  {
    id: 'network.connections',
    section: 'network',
    weight: 2,
    title: `${CONNECTIONS_MIN}+ connections`,
    needs: ['connections'],
    check: (f) => {
      const c = f.connections!;
      return c.count >= CONNECTIONS_MIN
        ? pass(`${c.count}${c.capped ? '+' : ''} connections.`)
        : improve(
            `${plural(c.count, 'connection')}.`,
            `Work toward ${CONNECTIONS_MIN}: connect with people you have worked or studied with. A large network makes an account look established.`,
          );
    },
  },

  // --- bonus ---
  {
    id: 'extras.sections',
    section: 'extras',
    weight: 1,
    bonus: true,
    title: 'Projects, certifications, languages and volunteering',
    needs: ['profile'],
    check: (f) => {
      const s = f.sections;
      const parts = [
        [s.projects, 'project', 'projects'],
        [s.certifications, 'certification', 'certifications'],
        [s.languages, 'language', 'languages'],
        [s.volunteering, 'volunteer role', 'volunteering'],
      ] as const;
      const have = parts.filter(([n]) => n > 0).map(([n, one]) => plural(n, one));
      const missing = parts.filter(([n]) => n === 0).map(([, , name]) => name);
      return missing.length
        ? improve(
            have.length ? `You list ${have.join(', ')}. No ${missing.join(', ')}.` : 'No projects, certifications, languages or volunteering are listed.',
            `Add ${missing.join(', ')}. You don't need them for a good profile, but they round it out.`,
          )
        : pass(`You list ${have.join(', ')}.`);
    },
  },
  {
    id: 'extras.recommendations',
    section: 'extras',
    weight: 1,
    bonus: true,
    title: 'Recommendations or endorsements',
    needs: ['recommendations'],
    check: (f) => {
      const recs = f.recommendationsReceived!;
      const ends = f.endorsements!;
      const have = [recs && plural(recs, 'recommendation'), ends && plural(ends, 'endorsement')].filter(Boolean);
      return have.length
        ? pass(`You have ${have.join(' and ')}.`)
        : improve(
            'No recommendations or endorsements show.',
            'Ask a former manager or colleague for a short recommendation about a result you delivered together. You don\'t need one for a good profile.',
          );
    },
  },
  {
    id: 'extras.featured',
    section: 'extras',
    weight: 1,
    bonus: true,
    title: 'Featured content',
    needs: ['featured'],
    check: (f) =>
      f.featured
        ? pass('You have a Featured section.')
        : improve('There is no Featured section.', 'Feature an article, a post, a talk or a project link at the top of your profile; it shows your work instead of describing it.'),
  },
];

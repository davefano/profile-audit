// The audit's vocabulary: rules read ProfileFacts and return findings.

import type { ProfileFacts } from '../linkedin/profile/facts';

export type Section = 'basics' | 'photo' | 'headline' | 'about' | 'experience' | 'education' | 'skills' | 'activity' | 'network' | 'extras';

export const SECTION_LABELS: Record<Section, string> = {
  basics: 'Basics',
  photo: 'Photo and banner',
  headline: 'Headline',
  about: 'About',
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  activity: 'Activity',
  network: 'Network',
  extras: 'Extra sections',
};

/**
 * Parts of a capture a rule depends on. If a part failed to load, the rule is
 * "not checked": a failed request is never reported as a weak profile.
 */
export type Part = 'profile' | 'about' | 'connections' | 'activity';

/** What a rule found. `null` from a check means the rule doesn't apply to this profile. */
export interface Check {
  pass: boolean;
  /** What was seen, in a sentence: "Your headline is 34 characters." */
  detail: string;
  /** What to do about it. Shown when the check doesn't pass. */
  tip?: string;
}

export interface Rule {
  /** Stable, dotted: "headline.length". AI suggestions and saved audits key on it. */
  id: string;
  section: Section;
  /** 1 = nice to have, 2 = matters, 3 = fundamental. */
  weight: 1 | 2 | 3;
  /**
   * A bonus rule isn't needed for a good profile, so it stays out of the score.
   * Passing every bonus rule on top of a strong score is what makes a standout profile.
   */
  bonus?: true;
  title: string;
  needs: Part[];
  check(facts: ProfileFacts, now: number): Check | null;
}

export type Status = 'pass' | 'improve' | 'not_checked';

export interface Finding {
  id: string;
  section: Section;
  weight: number;
  bonus: boolean;
  title: string;
  status: Status;
  detail: string;
  tip?: string;
}

export interface AuditReport {
  /** 0–100: passed weight over checked weight, core rules only. Null when nothing could be checked. */
  score: number | null;
  /** `standout`: a strong score and every checked bonus rule passes. */
  level: 'standout' | 'strong' | 'good' | 'needs_work' | null;
  findings: Finding[];
}

// Runs every rule over a profile's facts and totals the result.

import type { ProfileFacts } from '../linkedin/profile/facts';
import { RULES } from './rules';
import type { AuditReport, Finding, Part, Rule } from './types';

const PART_LABELS: Record<Part, string> = {
  profile: 'the profile record',
  about: 'the "About this profile" details',
  connections: 'the connection count',
  activity: 'recent activity',
};

function loaded(f: ProfileFacts, part: Part): boolean {
  switch (part) {
    case 'profile':
      return f.profileLoaded;
    case 'about':
      return f.about != null;
    case 'connections':
      return f.connections != null;
    case 'activity':
      return f.activity != null;
  }
}

export function auditProfile(facts: ProfileFacts, now = Date.now(), rules: Rule[] = RULES): AuditReport {
  const findings: Finding[] = [];
  for (const rule of rules) {
    const base = { id: rule.id, section: rule.section, weight: rule.weight, title: rule.title };
    const missing = rule.needs.filter((p) => !loaded(facts, p));
    if (missing.length) {
      findings.push({ ...base, status: 'not_checked', detail: `Couldn't read ${missing.map((p) => PART_LABELS[p]).join(' or ')} this time.` });
      continue;
    }
    const c = rule.check(facts, now);
    if (!c) continue;
    findings.push({ ...base, status: c.pass ? 'pass' : 'improve', detail: c.detail, ...(c.pass || !c.tip ? {} : { tip: c.tip }) });
  }
  const checked = findings.filter((f) => f.status !== 'not_checked');
  const total = checked.reduce((n, f) => n + f.weight, 0);
  const passed = checked.filter((f) => f.status === 'pass').reduce((n, f) => n + f.weight, 0);
  const score = total ? Math.round((100 * passed) / total) : null;
  const level = score == null ? null : score >= 80 ? 'strong' : score >= 55 ? 'good' : 'needs_work';
  return { score, level, findings };
}

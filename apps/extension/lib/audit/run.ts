// The audit feature: read the profile in the active tab and run the rules on it.

import { auditProfile, type AuditReport } from '@profile-audit/core/audit';
import { activeLinkedInTab, linkedin } from '@/lib/linkedin/client';

export interface AuditResult {
  slug: string;
  name: string | null;
  headline: string | null;
  photoUrl: string | null;
  capturedAt: number;
  report: AuditReport;
  /** Payloads that failed to load; their rules show as "not checked". */
  errors: Record<string, string>;
}

/** The profile slug in the active tab, or null when the tab isn't a LinkedIn profile. */
export async function activeProfileSlug(): Promise<string | null> {
  return (await activeLinkedInTab())?.profileSlug ?? null;
}

export async function auditActiveProfile(): Promise<AuditResult | null> {
  const tab = await activeLinkedInTab();
  if (!tab?.profileSlug) return null;
  const { slug, facts, capturedAt, errors } = await linkedin.profile(tab.profileSlug, { tab });
  return {
    slug,
    name: [facts.firstName, facts.lastName].filter(Boolean).join(' ') || null,
    headline: facts.headline,
    photoUrl: facts.photoUrl,
    capturedAt,
    report: auditProfile(facts, capturedAt),
    errors,
  };
}

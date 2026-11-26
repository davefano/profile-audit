// Structured facts extracted from a RawSnapshot. This is what the audit rules
// read. Every field may be null: LinkedIn changes
// shape, and any single request can fail.

import { mediaUploadedAt } from '../html';
import { estimateJoinedAt } from '../join-estimate';
import { memberIdFromProfileId, memberIdFromUrn, postTimestampMs, profileIdFromUrn } from '../ids';
import { parseCountText, postIds, rscTexts } from '../rsc';
import type { RawSnapshot } from './snapshot';

export interface YearMonth {
  year: number;
  month?: number;
}

export interface Position {
  title: string | null;
  company: string | null;
  /** LinkedIn company ID when the position links to a company page. */
  companyId: number | null;
  /** The role's description, as the member wrote it. */
  description: string | null;
  location: string | null;
  /** "Full-time", "Contract", … */
  employmentType: string | null;
  start: YearMonth | null;
  end: YearMonth | null;
}

export interface Education {
  school: string | null;
  degree: string | null;
  field: string | null;
  description: string | null;
  start: YearMonth | null;
  end: YearMonth | null;
}

export interface ProfileFacts {
  /** Whether the full profile record loaded. When false, history fields are unknown, not empty. */
  profileLoaded: boolean;
  /** Small profile photo URL for display. Signed and short-lived. */
  photoUrl: string | null;
  memberId: number | null;
  profileId: string | null;
  slug: string | null;
  versionTag: string | null;
  firstName: string | null;
  lastName: string | null;
  headline: string | null;
  summary: string | null;
  countryCode: string | null;
  geoName: string | null;
  industry: string | null;
  premium: boolean | null;
  creator: boolean | null;
  influencer: boolean | null;
  memorialized: boolean | null;
  photo: { present: boolean; uploadedAt: number | null } | null;
  background: { present: boolean; uploadedAt: number | null } | null;
  positions: Position[];
  educations: Education[];
  /** Skill names included in the profile payload (LinkedIn returns a subset). */
  skills: string[];
  /** How many skills the profile lists in all: the collection's total, which counts past the subset above. */
  skillCount: number;
  /** Entries in the optional sections, counted. All 0 when the profile record didn't load. */
  sections: Sections;
  followers: number | null;
  connections: { count: number; capped: boolean } | null;
  /** Connections shared with whoever captured this. Relative to the viewer. */
  mutualConnections: number | null;
  /** When the account was created. `about` = LinkedIn's own "Joined" line; `memberId` = estimate. */
  joined: { at: number; source: 'about' | 'memberId' } | null;
  about: {
    contactInfoUpdated: string | null;
    photoUpdated: string | null;
    /** e.g. ["Identity: Verified by LinkedIn in April 2026"]. Empty = no verifications. */
    verifications: string[];
  } | null;
  activity: { postCount: number; newestAt: number | null; oldestAt: number | null } | null;
}

export interface Sections {
  certifications: number;
  projects: number;
  volunteering: number;
  honors: number;
  organizations: number;
  languages: number;
  courses: number;
  publications: number;
}

const NO_SECTIONS: Sections = { certifications: 0, projects: 0, volunteering: 0, honors: 0, organizations: 0, languages: 0, courses: 0, publications: 0 };

type Entity = Record<string, any>;

// Payloads may come from an untrusted upload: narrow every value we read.
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);
/** The `included` entities of a normalized payload: objects only. */
function includedOf(json: unknown): Entity[] {
  const inc = (json as { included?: unknown } | null)?.included;
  return Array.isArray(inc) ? inc.filter((e): e is Entity => !!e && typeof e === 'object' && !Array.isArray(e)) : [];
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** "May 2013" → ms at mid-month (UTC). */
export function parseMonthYear(s: string | null | undefined): number | null {
  const m = s?.trim().match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (!m) return null;
  const month = MONTHS.indexOf(m[1]!.toLowerCase());
  return month < 0 ? null : Date.UTC(Number(m[2]), month, 15);
}

function ym(d: any): YearMonth | null {
  if (!d || typeof d.year !== 'number') return null;
  return typeof d.month === 'number' ? { year: d.year, month: d.month } : { year: d.year };
}

/** Upload timestamp from a vector image's artifact paths (…/0/1696284332069). */
function imageInfo(pic: any): { present: boolean; uploadedAt: number | null } {
  const raw = pic?.displayImageReference?.vectorImage?.artifacts;
  const artifacts: any[] = Array.isArray(raw) ? raw : [];
  if (!artifacts.length) return { present: false, uploadedAt: null };
  return { present: true, uploadedAt: mediaUploadedAt(String(artifacts[0]?.fileIdentifyingUrlPathSegment ?? '')) };
}

function imageUrl(pic: any): string | null {
  const v = pic?.displayImageReference?.vectorImage;
  const seg = v?.artifacts?.[0]?.fileIdentifyingUrlPathSegment;
  return typeof v?.rootUrl === 'string' && typeof seg === 'string' ? v.rootUrl + seg : null;
}

function parseFullProfile(json: unknown, want: { profileId: string | null; slug: string }) {
  const included = includedOf(json);
  const ofType = (suffix: string) => included.filter((e) => typeof e.$type === 'string' && e.$type.endsWith(suffix));
  const byUrnMap = new Map(included.filter((e) => typeof e.entityUrn === 'string').map((e) => [e.entityUrn as string, e]));
  const byUrn = { get: (u: unknown) => (typeof u === 'string' ? byUrnMap.get(u) : undefined) };
  // The payload also carries other people's profiles (recommenders, people
  // also viewed), so pick the one that was asked for.
  const profiles = ofType('.identity.profile.Profile');
  const p =
    (want.profileId && profiles.find((e) => profileIdFromUrn(e.entityUrn) === want.profileId)) ||
    profiles.find((e) => e.publicIdentifier === want.slug) ||
    (profiles.length === 1 ? profiles[0] : undefined);
  if (!p) return null;
  const pid = profileIdFromUrn(p.entityUrn);
  // Child URNs embed the owner: urn:li:fsd_profilePosition:(<profileId>,<n>).
  const own = (e: Entity) => !String(e.entityUrn ?? '').includes('(') || (!!pid && String(e.entityUrn).includes(`(${pid},`));
  const byType = (suffix: string) => ofType(suffix).filter(own);
  const geo = byUrn.get(p.geoLocation?.geoUrn);
  // The profile points at a collection per section (*profileSkills, …). Its paging
  // total counts every entry, including ones the payload leaves out.
  const count = (collection: string, suffix: string) => {
    const total = byUrn.get(p[collection])?.paging?.total;
    const included = byType(suffix).length;
    return typeof total === 'number' ? Math.max(total, included) : included;
  };
  return {
    profileId: profileIdFromUrn(p.entityUrn),
    memberId: memberIdFromUrn(p.objectUrn),
    slug: str(p.publicIdentifier),
    versionTag: str(p.versionTag),
    firstName: str(p.firstName),
    lastName: str(p.lastName),
    headline: str(p.headline),
    summary: str(p.summary),
    countryCode: str(p.location?.countryCode),
    geoName: str(geo?.defaultLocalizedName) ?? str(geo?.defaultLocalizedNameWithoutCountryName),
    industry: str(byUrn.get(p.industryUrn)?.name),
    premium: bool(p.premium),
    creator: bool(p.creator),
    influencer: bool(p.influencer),
    memorialized: bool(p.memorialized),
    // A loaded profile without a picture field has no picture.
    photo: imageInfo(p.profilePicture),
    photoUrl: imageUrl(p.profilePicture),
    background: imageInfo(p.backgroundPicture),
    positions: byType('.identity.profile.Position').map((x) => ({
      title: str(x.title),
      company: str(x.companyName),
      companyId: Number(String(x.companyUrn ?? '').match(/fsd_company:(\d+)$/)?.[1]) || null,
      description: str(x.description),
      location: str(x.locationName) ?? str(x.geoLocationName),
      employmentType: str(byUrn.get(x.employmentTypeUrn)?.name),
      start: ym(x.dateRange?.start),
      end: ym(x.dateRange?.end),
    })),
    educations: byType('.identity.profile.Education').map((x) => ({
      school: str(x.schoolName),
      degree: str(x.degreeName),
      field: str(x.fieldOfStudy),
      description: str(x.description),
      start: ym(x.dateRange?.start),
      end: ym(x.dateRange?.end),
    })),
    skills: byType('.identity.profile.Skill').map((x) => str(x.name)).filter((x): x is string => !!x),
    skillCount: count('*profileSkills', '.identity.profile.Skill'),
    sections: {
      certifications: count('*profileCertifications', '.identity.profile.Certification'),
      projects: count('*profileProjects', '.identity.profile.Project'),
      volunteering: count('*profileVolunteerExperiences', '.identity.profile.VolunteerExperience'),
      honors: count('*profileHonors', '.identity.profile.Honor'),
      organizations: count('*profileOrganizations', '.identity.profile.Organization'),
      languages: count('*profileLanguages', '.identity.profile.Language'),
      courses: count('*profileCourses', '.identity.profile.Course'),
      publications: count('*profilePublications', '.identity.profile.Publication'),
    },
  };
}

/** Read the About-this-member dialog's label/value text pairs. */
export function parseAbout(rsc: string) {
  const t = rscTexts(rsc);
  const after = (label: string) => {
    const i = t.indexOf(label);
    return i >= 0 ? (t[i + 1] ?? null) : null;
  };
  const verifications: string[] = [];
  const vStart = t.indexOf('Verifications');
  if (vStart >= 0) {
    const vEnd = t.findIndex((s, i) => i > vStart && /^Learn more/i.test(s));
    const items = t.slice(vStart + 1, vEnd > 0 ? vEnd : undefined);
    for (let i = 0; i < items.length; i++) {
      if (/have any verifications/i.test(items[i]!)) break;
      if (/^Verified/i.test(items[i + 1] ?? '')) {
        verifications.push(`${items[i]}: ${items[i + 1]}`);
        i++;
      }
    }
  }
  return {
    joinedAt: parseMonthYear(after('Joined LinkedIn')),
    contactInfoUpdated: after('Contact info'),
    photoUpdated: after('Profile photo'),
    verifications,
  };
}

export function parseActivity(rsc: string) {
  const times = postIds(rsc).map(postTimestampMs).sort((a, b) => b - a);
  const followers = rscTexts(rsc).map((s) => parseCountText(s, 'followers')).find(Boolean) ?? null;
  return {
    postCount: times.length,
    newestAt: times[0] ?? null,
    oldestAt: times.at(-1) ?? null,
    followers: followers?.count ?? null,
  };
}

/** "Avery and Quinn are mutual connections" → 2; "A, B, and 12 other mutual connections" → 14. */
export function parseMutual(text: string | null | undefined): number | null {
  if (!text) return null;
  const others = Number(/(\d[\d,]*)\s+other mutual/.exec(text)?.[1]?.replace(/,/g, '') ?? 0);
  const head = text.replace(/,?\s*and\s+\d[\d,]*\s+other mutual connections?.*$/i, '').replace(/\s+(?:is a|are)\s+mutual connections?.*$/i, '');
  // A bare "are mutual connections" (names lost) counts as unknown, not one.
  const named = head.trim() && !/^(?:is a|are)\b/i.test(head.trim()) ? head.split(/,\s*|\s+and\s+/).filter((s) => s.trim()).length : 0;
  return named + others || null;
}

/** The profile entity in the slug-resolve payload. */
export function resolvedProfile(resolve: unknown): { entityUrn: string; versionTag: string | null } | undefined {
  const e = includedOf(resolve).find((x) => typeof x.entityUrn === 'string' && x.entityUrn.startsWith('urn:li:fsd_profile:'));
  return e ? { entityUrn: e.entityUrn, versionTag: str(e.versionTag) } : undefined;
}

export function extractProfileFacts(snap: RawSnapshot, now = Date.now()): ProfileFacts {
  const resolved = resolvedProfile(snap.payloads.resolve);
  const wantId = snap.profileId ?? profileIdFromUrn(resolved?.entityUrn);
  const full = snap.payloads.fullProfile ? parseFullProfile(snap.payloads.fullProfile, { profileId: wantId, slug: snap.slug }) : null;
  const about = snap.payloads.about ? parseAbout(snap.payloads.about) : null;
  const activity = snap.payloads.activity ? parseActivity(snap.payloads.activity) : null;

  const profileId = full?.profileId ?? snap.profileId ?? profileIdFromUrn(resolved?.entityUrn);
  const memberId = full?.memberId ?? memberIdFromProfileId(profileId);

  const pageCounts = snap.payloads.profilePageCounts ?? [];
  const connections = pageCounts.map((s) => parseCountText(s, 'connections')).find(Boolean) ?? null;
  const pageFollowers = pageCounts.map((s) => parseCountText(s, 'followers')).find(Boolean)?.count ?? null;
  const followerState = (snap.payloads.followingState as any)?.data?.followerCount;

  let joined: ProfileFacts['joined'] = null;
  if (about?.joinedAt) joined = { at: about.joinedAt, source: 'about' };
  else if (memberId) {
    const est = estimateJoinedAt(memberId, now);
    if (est) joined = { at: est, source: 'memberId' };
  }

  return {
    profileLoaded: !!full,
    photoUrl: full?.photoUrl ?? null,
    memberId,
    profileId,
    slug: full?.slug ?? snap.slug,
    versionTag: full?.versionTag ?? resolved?.versionTag ?? null,
    firstName: full?.firstName ?? null,
    lastName: full?.lastName ?? null,
    headline: full?.headline ?? null,
    summary: full?.summary ?? null,
    countryCode: full?.countryCode ?? null,
    geoName: full?.geoName ?? null,
    industry: full?.industry ?? null,
    premium: full?.premium ?? null,
    creator: full?.creator ?? null,
    influencer: full?.influencer ?? null,
    memorialized: full?.memorialized ?? null,
    photo: full?.photo ?? null,
    background: full?.background ?? null,
    positions: full?.positions ?? [],
    educations: full?.educations ?? [],
    skills: full?.skills ?? [],
    skillCount: full?.skillCount ?? 0,
    sections: full?.sections ?? NO_SECTIONS,
    followers: typeof followerState === 'number' ? followerState : (activity?.followers ?? pageFollowers),
    connections,
    mutualConnections: snap.payloads.profilePageMutualCount ?? null,
    joined,
    about: about && { contactInfoUpdated: about.contactInfoUpdated, photoUpdated: about.photoUpdated, verifications: about.verifications },
    activity: activity && { postCount: activity.postCount, newestAt: activity.newestAt, oldestAt: activity.oldestAt },
  };
}

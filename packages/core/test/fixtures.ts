// Synthetic LinkedIn payloads for tests. Same shapes as the real responses
// (see docs/linkedin-data-sources.md), but entirely made-up people.

import type { RawSnapshot } from '../src/linkedin/profile/snapshot';

export const DAY = 86_400_000;

/** A profile ID (`ACoAA…`) that encodes `memberId`, like LinkedIn's. */
export function profileIdFor(memberId: number): string {
  const b = new Uint8Array(20);
  b.set([0x00, 0x2a, 0x00, 0x00]);
  new DataView(b.buffer).setUint32(4, memberId);
  b.set([0x01, 0x0a, 0x5e, 0x11, 0x7a, 0x33, 0x90, 0x01, 0x42, 0x24, 0x77, 0x18], 8);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A post ID created at `ms`, like LinkedIn's activity IDs. */
export function postIdAt(ms: number): string {
  return ((BigInt(ms) << 22n) | 1234n).toString();
}

/** Serialize text nodes the way an RSC flight stream does. */
function rsc(texts: string[]): string {
  return texts.map((t, i) => `${i.toString(16)}:${JSON.stringify(['$', 'p', null, { className: 'x', children: [t] }])}`).join('\n');
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthYear = (ms: number) => `${MONTHS[new Date(ms).getUTCMonth()]} ${new Date(ms).getUTCFullYear()}`;

export interface FakeProfile {
  memberId?: number;
  slug?: string;
  firstName?: string;
  lastName?: string;
  headline?: string;
  summary?: string | null;
  premium?: boolean;
  influencer?: boolean;
  photoUploadedAt?: number | null;
  positions?: Array<{ title: string; company: string; startYear: number; endYear?: number; companyId?: number; description?: string }>;
  /** Upload time of a custom background banner; none by default. */
  backgroundUploadedAt?: number | null;
  certifications?: number;
  /** Unrelated profiles LinkedIn bundles in (recommenders, people also viewed), placed first. */
  strangers?: number;
  educations?: number;
  skills?: number;
  joinedAt?: number | null;
  verifications?: Array<[string, string]>;
  connections?: string | null;
  followers?: number | null;
  postTimes?: number[] | null;
  capturedAt?: number;
}

export function fakeSnapshot(p: FakeProfile = {}): RawSnapshot {
  const memberId = p.memberId ?? 700_000_001;
  const profileId = profileIdFor(memberId);
  const slug = p.slug ?? 'jordan-sample-0a1b2c';
  const urn = `urn:li:fsd_profile:${profileId}`;
  const image = (segment: string) => ({
    displayImageReference: { vectorImage: { rootUrl: 'https://media.example/', artifacts: [{ fileIdentifyingUrlPathSegment: segment }] } },
  });
  const photo =
    p.photoUploadedAt === null ? undefined : image(`100_100/profile-displayphoto-shrink_100_100/0/${p.photoUploadedAt ?? 1_600_000_000_000}?e=1&t=x`);
  const positions = p.positions ?? [{ title: 'Software Engineer', company: 'Example Corp', startYear: 2018 }];
  const strangers = Array.from({ length: p.strangers ?? 0 }, (_, i) => {
    const sid = profileIdFor(900_000_000 + i);
    return [
      {
        $type: 'com.linkedin.voyager.dash.identity.profile.Profile',
        entityUrn: `urn:li:fsd_profile:${sid}`,
        objectUrn: `urn:li:member:${900_000_000 + i}`,
        publicIdentifier: `stranger-${i}`,
        firstName: 'Other',
        lastName: `Person${i}`,
      },
      {
        $type: 'com.linkedin.voyager.dash.identity.profile.Position',
        entityUrn: `urn:li:fsd_profilePosition:(${sid},0)`,
        title: 'Unrelated role',
        companyName: 'Elsewhere Inc',
        dateRange: { start: { year: 1999, month: 1 } },
      },
    ];
  }).flat();
  const included: Record<string, unknown>[] = [
    ...strangers,
    {
      $type: 'com.linkedin.voyager.dash.identity.profile.Profile',
      entityUrn: urn,
      objectUrn: `urn:li:member:${memberId}`,
      publicIdentifier: slug,
      versionTag: '1000000001',
      firstName: p.firstName ?? 'Jordan',
      lastName: p.lastName ?? 'Sample',
      headline: p.headline ?? 'Software Engineer at Example Corp',
      summary: p.summary === undefined ? 'I build reliable systems and mentor new engineers on my team.' : p.summary,
      premium: p.premium ?? false,
      creator: false,
      influencer: p.influencer ?? false,
      memorialized: false,
      location: { countryCode: 'US' },
      geoLocation: { geoUrn: 'urn:li:fsd_geo:1' },
      industryUrn: 'urn:li:fsd_industry:4',
      profilePicture: photo,
      ...(p.backgroundUploadedAt ? { backgroundPicture: image(`1584_396/profile-displaybackgroundimage-shrink_350_1400/0/${p.backgroundUploadedAt}?e=1&t=x`) } : {}),
    },
    { $type: 'com.linkedin.voyager.dash.common.Geo', entityUrn: 'urn:li:fsd_geo:1', defaultLocalizedName: 'Springfield, United States' },
    { $type: 'com.linkedin.voyager.dash.common.Industry', entityUrn: 'urn:li:fsd_industry:4', name: 'Software Development' },
    ...positions.map((x, i) => ({
      $type: 'com.linkedin.voyager.dash.identity.profile.Position',
      entityUrn: `urn:li:fsd_profilePosition:(${profileId},${i})`,
      title: x.title,
      companyName: x.company,
      ...(x.companyId ? { companyUrn: `urn:li:fsd_company:${x.companyId}` } : {}),
      ...(x.description ? { description: x.description } : {}),
      dateRange: { start: { year: x.startYear, month: 1 }, ...(x.endYear ? { end: { year: x.endYear, month: 1 } } : {}) },
    })),
    ...Array.from({ length: p.educations ?? 1 }, (_, i) => ({
      $type: 'com.linkedin.voyager.dash.identity.profile.Education',
      entityUrn: `urn:li:fsd_profileEducation:(${profileId},${i})`,
      schoolName: 'State University',
      degreeName: 'BS',
      fieldOfStudy: 'Computer Science',
      dateRange: { start: { year: 2010 }, end: { year: 2014 } },
    })),
    ...Array.from({ length: p.skills ?? 3 }, (_, i) => ({
      $type: 'com.linkedin.voyager.dash.identity.profile.Skill',
      entityUrn: `urn:li:fsd_skill:(${profileId},${i})`,
      name: `Skill ${i}`,
    })),
    ...Array.from({ length: p.certifications ?? 0 }, (_, i) => ({
      $type: 'com.linkedin.voyager.dash.identity.profile.Certification',
      entityUrn: `urn:li:fsd_profileCertification:(${profileId},${i})`,
      name: `Certificate ${i}`,
    })),
  ];

  const joinedAt = p.joinedAt === undefined ? Date.UTC(2016, 2, 15) : p.joinedAt;
  const verifications = p.verifications ?? [];
  const about =
    joinedAt === null
      ? undefined
      : rsc([
          'Account history',
          'Joined LinkedIn',
          monthYear(joinedAt),
          'Contact info',
          'Updated over 1 year ago',
          'Profile photo',
          'Updated over 1 year ago',
          'Verifications',
          ...(verifications.length ? verifications.flat() : [`${p.firstName ?? 'Jordan'} doesn’t have any verifications yet.`]),
          'Learn more about verifications',
        ]);

  const postTimes = p.postTimes === undefined ? [Date.UTC(2026, 9, 1)] : p.postTimes;
  const activity =
    postTimes === null
      ? undefined
      : rsc(['Activity', `${(p.followers ?? 300).toLocaleString('en-US')} followers`]) +
        '\n' +
        postTimes.map((t, i) => `${(100 + i).toString(16)}:{"urn":"urn:li:activity:${postIdAt(t)}"}`).join('\n');

  const connections = p.connections === undefined ? '500+ connections' : p.connections;
  return {
    schema: 1,
    capturedAt: p.capturedAt ?? Date.UTC(2026, 10, 17),
    slug,
    profileId,
    payloads: {
      resolve: { included: [{ entityUrn: urn, versionTag: '1000000001' }] },
      fullProfile: { data: {}, included },
      followingState: p.followers === null ? undefined : { data: { followerCount: p.followers ?? 300 } },
      about,
      activity,
      profilePageCounts: connections ? [connections] : [],
    },
    errors: {},
  };
}

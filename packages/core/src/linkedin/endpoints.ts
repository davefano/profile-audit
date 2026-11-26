// LinkedIn's internal endpoints. Unofficial and versioned: when LinkedIn ships a
// new web build, query IDs and decoration versions can change. Keep them here.
// See docs/linkedin-data-sources.md.

export const endpoints = {
  /** Slug or profile ID → fsd_profile URN + versionTag. */
  resolve: (memberIdentity: string) =>
    `/voyager/api/graphql?includeWebMetadata=true&variables=(memberIdentity:${encodeURIComponent(memberIdentity)})` +
    '&queryId=voyagerIdentityDashProfiles.b5c27c04968c409fc0ed3546575b9b7a',

  /** Full profile: identity, flags, photos, positions, education, skills. */
  fullProfile: (slug: string) =>
    `/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${encodeURIComponent(slug)}` +
    '&decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-93',

  /** Exact follower count. */
  followingState: (profileId: string) =>
    `/voyager/api/feed/dash/followingStates/urn:li:fsd_followingState:urn:li:fsd_profile:${profileId}`,

  /** Server-rendered profile page; we only keep its connection/follower count text. */
  profilePage: (slug: string) => `/in/${encodeURIComponent(slug)}/`,

};

const ABOUT_SCREEN = 'com.linkedin.sdui.flagshipnav.trustverifications.ProfileVerificationDetailsDialog';

/** "About this member" dialog: join date, verifications, recent photo/contact changes. */
export function aboutRequest(profileId: string, slug: string) {
  return {
    url: `/flagship-web/rsc-action/actions/navigation?screenId=${ABOUT_SCREEN}&sduiid=${ABOUT_SCREEN}`,
    body: {
      clientArguments: {
        $type: 'proto.sdui.actions.requests.RequestedArguments',
        requestedStateKeys: [],
        payload: {
          vieweeProfileId: profileId,
          entryPoint: 6,
          profileRefreshKey: slug,
          triggerRefKey: `ProfileVerificationTriggerRef-${slug}`,
        },
        requestMetadata: { $type: 'proto.sdui.common.RequestMetadata' },
        states: [],
        screenId: ABOUT_SCREEN,
        knownTemplateIds: [],
      },
      isModal: true,
    },
  };
}

/**
 * Profile cards, each a server-rendered component. The parts below Activity
 * hold fixed section types: Part2 is Recommendations, Part7 is Skills with
 * their endorsement counts (checked on two profiles, 2026-11-26).
 */
export const PROFILE_CARDS = {
  /** Recent post IDs (which encode timestamps) and the follower count. */
  activity: 'profileCardsActivity',
  /** About and Featured. */
  aboveActivity: 'profileCardsAboveActivity',
  recommendations: 'profileCardsBelowActivityPart2',
  skills: 'profileCardsBelowActivityPart7',
} as const;

export function profileCardRequest(card: keyof typeof PROFILE_CARDS, slug: string) {
  const id = `com.linkedin.sdui.generated.profile.dsl.impl.${PROFILE_CARDS[card]}`;
  return {
    url: `/flagship-web/rsc-action/actions/component?componentId=${id}&sduiid=${id}`,
    body: {
      componentId: id,
      clientArguments: {
        payload: { isSelfView: false, vanityName: slug },
        states: [],
        requestMetadata: { $type: 'proto.sdui.common.RequestMetadata' },
        screenId: 'com.linkedin.sdui.flagshipnav.home.Home',
        knownTemplateIds: [],
      },
    },
  };
}

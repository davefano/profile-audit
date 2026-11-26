// A raw snapshot is everything we captured for one profile at one moment,
// unparsed. It's what gets archived (e.g. to R2), so parsers can be improved
// and re-run over history later.

export const SNAPSHOT_SCHEMA = 1;

export interface RawSnapshot {
  schema: typeof SNAPSHOT_SCHEMA;
  capturedAt: number;
  /** Slug as requested (may differ from the canonical publicIdentifier). */
  slug: string;
  profileId: string | null;
  payloads: {
    resolve?: unknown;
    fullProfile?: unknown;
    followingState?: unknown;
    /** RSC flight text of the About-this-member dialog. */
    about?: string;
    /** RSC flight text of the profile Activity card. */
    activity?: string;
    /** RSC flight text of the cards above Activity: About and Featured. */
    aboveActivityCard?: string;
    /** RSC flight text of the Recommendations card. */
    recommendationsCard?: string;
    /** RSC flight text of the Skills card, with endorsement counts. */
    skillsCard?: string;
    /** Count phrases found in the profile page HTML, e.g. ["500+ connections"]. */
    profilePageCounts?: string[];
    /**
     * Connections the viewer shares with the profile. Only the count is kept:
     * the page's text names the viewer's contacts, which must not leave the tab.
     */
    profilePageMutualCount?: number | null;
  };
  /** Per-payload fetch failures, keyed like `payloads`. */
  errors: Record<string, string>;
}

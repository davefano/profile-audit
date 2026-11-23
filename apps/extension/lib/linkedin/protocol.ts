// Messages for reading LinkedIn through the user's LinkedIn tab. Feature-free:
// anything in the extension that needs LinkedIn data uses these through client.ts.

import type { ProfileFacts } from '@profile-audit/core/linkedin';
import type { ErrorResponse } from '@/lib/runtime';

export interface ProfileResult {
  slug: string;
  facts: ProfileFacts;
  capturedAt: number;
  /** Payloads that failed, e.g. { about: "HTTP 403" }. */
  errors: Record<string, string>;
}

export interface LinkedInMessages {
  LI_PROFILE: {
    req: { type: 'LI_PROFILE'; slug: string; includeActivity?: boolean };
    res: ProfileResult | ErrorResponse;
  };
}

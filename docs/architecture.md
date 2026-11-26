# Architecture

Two layers, kept apart so each can change without the other.

```
packages/core/src/
  linkedin/     data layer: fetch, parse, describe a profile. Never judges anything.
  audit/        rules: ProfileFacts in, findings out. Never fetches.

apps/extension/lib/
  runtime.ts    typed messaging between extension contexts
  linkedin/     the extension's LinkedIn bridge (feature-free)
  audit/        the audit feature: read the active profile, run the rules
  panel/        the UI
```

`packages/core/test/layers.test.ts` fails if `src/linkedin` imports anything
outside itself, or if `src/audit` imports anything but its own files and the
profile facts types. `apps/extension/test/layers.test.ts` fails if
`lib/linkedin` imports anything but the LinkedIn layer and the runtime.

## The LinkedIn data layer (`@profile-audit/core/linkedin`)

Copied from Fake Profile Reporter's `packages/core/src/linkedin` (commit
7c80425), keeping the profile half. Its endpoint notes live there, in
`docs/linkedin-data-sources.md`.

| Module | What it gives you |
|---|---|
| `session.ts` | `createSession({ fetch, base, csrf })`: `voyager()`, `rsc()`, `html()`, signed in. |
| `endpoints.ts` | Every URL and query ID, in one place, because LinkedIn changes them. |
| `target.ts` | `profileSlugFromUrl(url)`. |
| `profile/` | `captureProfile()` → raw snapshot (6 requests); `extractProfileFacts()` → `ProfileFacts`. |
| `ids.ts`, `join-estimate.ts` | Member IDs from profile IDs; account age; post times from post IDs. |

Added here: `ProfileFacts` carries each role's description, location and
employment type, education descriptions, and counts of certifications,
projects, volunteering, honors and organizations.

Signed-in calls must run in a `www.linkedin.com` page context. In the
extension that is the content script, reached through `lib/linkedin/client.ts`:

```ts
const tab = await activeLinkedInTab();
const { facts } = await linkedin.profile(tab.profileSlug, { tab });
```

## The audit (`@profile-audit/core/audit`)

`auditProfile(facts, now)` runs every rule in `RULES` (`rules.ts`) and returns
an `AuditReport`: findings with a status (`pass`, `improve`, `not_checked`),
a 0–100 score (passed weight over checked weight, core rules only) and a
level. What the rules check, and why, is in [rubric.md](rubric.md).

A rule is `{ id, section, weight, bonus?, title, needs, check }`:

- `needs` names the parts of the capture it reads (`profile`, `about`,
  `connections`, `activity`). If one failed to load, the rule is reported as
  not checked and kept out of the score.
- `check(facts, now)` returns `{ pass, detail, tip }`, or `null` when the rule
  doesn't apply (no headline means no headline-length rule).
- `weight` is 1 (nice to have), 2 (matters) or 3 (fundamental).
- `bonus: true` keeps a rule out of the score. The level is `standout` when the
  score is 90 or more and every bonus rule passes (one that wasn't checked
  counts as not passed).
- `id` is stable once shipped: saved audits and AI suggestions key on it.

To add a rule, add it to `RULES` and a case to `packages/core/test/audit.test.ts`;
the complete-profile test must still pass every rule.

Featured, recommendations and endorsements come from the profile cards
(`PROFILE_CARDS` in `endpoints.ts`): server-rendered UI in the viewer's
language, read by their English headings. Not read yet: open-to-work, the
custom button and contact info. Activity is the profile's Activity card, which
may not include comments and reactions.

The profile payload's `summary` has its line breaks removed (role descriptions
keep theirs), so the About rules read a sentence end followed by a capital
letter as a break: `aboutLines()` in `rules.ts`.

## Planned: AI suggestions

Bring your own key, for OpenRouter. Not built yet. The intended shape:

- `packages/core/src/coach/`: builds prompts from `ProfileFacts` and the
  `improve` findings (one prompt per section: headline, About, a role) and
  parses the model's answer. Pure, like `audit/`; it never fetches.
- `apps/extension/lib/coach/`: the key in `browser.storage.local`, the model
  choice, and the call to `https://openrouter.ai/api/v1/chat/completions`,
  with an optional host permission for openrouter.ai requested when the key
  is saved.
- The panel shows a "Draft with AI" action on a finding. Drafts are text to
  copy; the extension never edits the profile.
- Profile text goes only to OpenRouter, only when the member asks for a draft.

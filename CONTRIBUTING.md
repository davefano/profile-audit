# Contributing

Issues and pull requests are welcome. Open an issue first for anything larger
than a fix, so we can agree on the approach.

## Setup

Requires [Bun](https://bun.sh) 1.4+. Use Bun for everything; there is no npm,
pnpm or yarn setup.

```bash
bun install
bun run check        # typecheck + tests; must pass before a pull request
bun run build:ext    # builds into apps/extension/.output/
```

[docs/architecture.md](docs/architecture.md) explains how the code is
organized and how to add a rule.

## Ground rules

- **LinkedIn is read-only.** The extension never clicks, posts, messages,
  follows or edits anything. It suggests; the member makes every change.
  Keep requests to one profile at a time, at a human pace.
- **No real people's data in the repo.** Tests use the synthetic profiles in
  `packages/core/test/fixtures.ts`. Don't commit captures of real profiles,
  names from them, or session cookies.
- **Rules of thumb, not LinkedIn requirements.** Copy suggests. Don't claim
  LinkedIn penalises something unless LinkedIn says so.
- **Not checked is not failed.** A rule whose data didn't load is reported as
  "not checked" and left out of the score.
- **Profile data stays in the browser.** The only planned exception is the AI
  step, which sends it to the provider the user configured, with their own key,
  when they ask.
- **Keep the layers apart.** `packages/core/src/linkedin` reads and parses;
  `packages/core/src/audit` judges. The layer tests fail if one imports the other.

## Changing the rules

Each rule lives in `packages/core/src/audit/rules.ts` and is listed in
[docs/rubric.md](docs/rubric.md). Update both, and add a case to
`packages/core/test/audit.test.ts`. Keep a shipped rule's `id` unchanged.

## Releases

Versions are the release date plus a counter (`2026.11.27.0`); see
[Versions](README.md#versions) in the README.

# Profile Audit

A browser extension that audits a LinkedIn profile and suggests what to
improve. Open source (MIT).

Open your profile on www.linkedin.com and open the side panel. It reads the
profile with your own signed-in session, runs a set of deterministic rules
(photo, headline, About, experience, skills, activity and more) and lists
suggestions, most important first. Nothing is sent anywhere.

Planned: bring your own OpenRouter key to have an AI model draft a better
headline, About section or role description from the audit.

## Project layout

```
packages/core/         shared TypeScript, no runtime deps; see docs/architecture.md
  src/linkedin/        data layer: read and parse a profile (no judging)
  src/audit/           rules: ProfileFacts in, findings and a score out (no fetching)
apps/extension/        the browser extension (WXT)
  entrypoints/content.ts      serves the LinkedIn bridge in your LinkedIn tab
  entrypoints/background.ts   toolbar toggle
  entrypoints/sidepanel/      Chrome side panel / Firefox sidebar
  entrypoints/popup/          Safari popup (Safari has no sidebar API)
  lib/linkedin/               reusable LinkedIn bridge and client (no feature logic)
  lib/audit/                  the audit feature: read the active profile, run the rules
  lib/panel/                  the UI
```

## Setup

Requires [Bun](https://bun.sh) 1.4+.

```bash
bun install
bun run check             # typecheck + tests
bun run build:ext         # builds for chrome, firefox, safari into apps/extension/.output/
```

Load `apps/extension/.output/chrome-mv3` with `chrome://extensions` → Load
unpacked. In Firefox, `bun run dev:ext:firefox` opens a browser with the
extension and hot reload. Chrome 158+ won't load extensions under automation,
so `bun run dev:ext` can't drive Chrome.

**Safari** needs a Mac with Xcode: build with `bun run --cwd apps/extension build:safari`,
then wrap it with `xcrun safari-web-extension-converter apps/extension/.output/safari-mv2`.

## License

MIT.

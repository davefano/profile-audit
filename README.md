# Profile Audit

A browser extension that audits a LinkedIn profile and suggests what to
improve. Open source (MIT).

Open your profile on www.linkedin.com and open the side panel. It reads the
profile with your own signed-in session, runs a set of deterministic rules
(photo, headline, About, experience, skills, activity and more) and lists
suggestions, most important first. Nothing is sent anywhere.

What it checks, and why, is in [docs/rubric.md](docs/rubric.md). The rules
are rules of thumb from reviewing profiles, not LinkedIn requirements.

Planned: bring your own OpenRouter key to have an AI model draft a better
headline, About section or role description from the audit.

## Install

Download the latest zip for your browser from
[Releases](https://github.com/davefano/profile-audit/releases).

- **Chrome:** unzip it, open `chrome://extensions`, turn on Developer mode,
  click **Load unpacked** and pick the unzipped folder. To update, unzip the
  new version over the same folder and click the reload icon on the extension.
- **Firefox:** open `about:debugging` › This Firefox › **Load Temporary
  Add-on** and pick the zip. It stays loaded until Firefox restarts.
- **Safari:** needs a Mac with Xcode; see [Setup](#setup).

Or build it yourself from source; see below.

## Privacy

The extension reads the profile in your active LinkedIn tab, using your own
signed-in session, one profile at a time. It makes no changes on LinkedIn and
has no server: the profile and the audit stay in your browser. Settings are
kept in the browser's extension storage.

Opening someone else's profile records a profile view, as it would without
the extension.

This is an independent project, not affiliated with or endorsed by LinkedIn.
It reads LinkedIn's internal web endpoints, which are undocumented and can
change without notice; when they do, parts of the audit show as "not checked"
until the extension is updated.

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

## Versions

The extension's version, in `apps/extension/package.json`, is the release date
plus a counter: `YEAR.MONTH.DAY.N`, e.g. `2026.11.23.1` for the second release
on 23 November 2026. `N` starts at 0 each day. Don't zero-pad the month or day
(`2026.3.5.0`, not `2026.03.05.0`): browsers reject version parts with leading
zeros. WXT copies the version into every browser's manifest.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE). The bundled Geist font (`apps/extension/lib/panel/fonts/`) is
under the SIL Open Font License; see `OFL.txt` beside it.

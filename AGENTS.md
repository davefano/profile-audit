# Profile Audit agent index

An open-source (MIT) browser extension that audits a LinkedIn profile against
clear, deterministic rules and suggests what to improve. A WXT extension and a
shared TypeScript core. A bring-your-own-key AI rewrite step (OpenRouter) is
planned; see [docs/architecture.md](docs/architecture.md#planned-ai-suggestions).

The LinkedIn reading code was copied from Fake Profile Reporter
(`~/workspaces/job-scam`, commit 7c80425), profile half only. When LinkedIn
changes an endpoint, the fix likely applies to both.

`bun run check` (typecheck + tests) is the gate: run it before reporting work done.

## Guards that always apply

- **Git.** Commit freely. Branch, merge or push only on the user's instruction
  this session; a plan or todo is never instruction. Merge commits, never squash.
- **Publishing.** Every extension store upload needs its own explicit request.
- **Bun only.** Never node, npm, npx, pnpm, yarn or tsx (`bunx` is fine). On
  this machine bun isn't on PATH: use `mise exec bun@1.4.4 -- bun …`.
- **Processes.** Start dev servers (`wxt`) only when asked, and stop the ones you start.
- **No feature flags** unless the user asks for one for this work.
- **Clean up your mess.** Delete what your change replaces.

## Guards for this project

- **LinkedIn is read-only.** No clicks or requests that change anything: no
  edits, messages, posts, connection requests or follows. The extension
  suggests; the member makes every edit themselves. One profile at a time, at
  a human pace; opening someone else's profile records a view.
- **Never move a LinkedIn session between browsers.** Copying cookies into
  another browser got the session revoked everywhere. Never print or store
  cookie or CSRF values outside the browser profile.
- **No real people's data in the repo.** Fixtures are synthetic
  (`packages/core/test/fixtures.ts`). Real captures stay out of git.
- **The user's personal details** (email, account names) stay out of commits,
  docs and requests to outside services.
- **Not checked is not failed.** A rule whose data didn't load is listed as
  "not checked" and left out of the score.
- **Rules of thumb, not LinkedIn requirements.** Copy suggests; it never
  claims LinkedIn penalises something unless LinkedIn says so.
- **Profile data leaves the browser only to the AI provider the user
  configured, with their own key, when they ask for it.** No other server.
- **Layers.** `packages/core/src/linkedin` (fetch and parse) never imports
  `packages/core/src/audit` (rules); `packages/core/test/layers.test.ts`
  enforces it. In the extension, `lib/linkedin/` stays feature-free
  (`apps/extension/test/layers.test.ts`).

## Open the page that owns the task

- How the code is organized, how to add a rule, the AI plan: [docs/architecture.md](docs/architecture.md)
- Setup and dev commands: [README.md](README.md)
- LinkedIn endpoints, payloads and quirks: `~/workspaces/job-scam/docs/linkedin-data-sources.md`
- Extension: `apps/extension` (WXT). Build with `bun run build:ext` and load
  `apps/extension/.output/chrome-mv3` unpacked; Chrome 158+ won't load
  extensions under automation, so `bun run dev:ext` can't drive Chrome.

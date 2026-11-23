// The extension UI. Mounted by the Chrome side panel, the Firefox sidebar, and
// the Safari popup (Safari has no sidebar API).

import { errorText } from '@/lib/runtime';
import { activeProfileSlug, auditActiveProfile, type AuditResult } from '@/lib/audit/run';
import { renderResult } from './views';
import './panel.css';

const MARKUP = `
<header class="top">
  <div class="title">Profile Audit</div>
  <button class="icon-btn" id="rerun" title="Audit again" aria-label="Audit again">
    <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16.5 10a6.5 6.5 0 1 1-2-4.7M16.5 3.5v3.8h-3.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </button>
</header>
<main id="view" aria-live="polite"></main>
`;

const $ = (id: string) => document.getElementById(id)!;

const EMPTY = `
  <div class="empty">
    <h2>Open a LinkedIn profile</h2>
    <p>Go to your own profile (or one you're helping with) on www.linkedin.com and the audit runs here.</p>
  </div>`;

/** Results by slug for this panel session, so switching tabs doesn't re-read LinkedIn. */
const results = new Map<string, AuditResult>();
let shownSlug: string | null = null;
let running = 0;

async function run(force = false) {
  // Only the latest run may draw: an older read finishing late must not replace a newer view.
  const mine = ++running;
  const slug = await activeProfileSlug();
  if (mine !== running) return;
  shownSlug = slug;
  const view = $('view');
  if (!slug) {
    view.innerHTML = EMPTY;
    return;
  }
  const cached = results.get(slug);
  if (cached && !force) {
    view.innerHTML = renderResult(cached);
    return;
  }
  view.innerHTML = '<p class="loading" role="status">Reading the profile…</p>';
  try {
    const r = await auditActiveProfile();
    if (mine !== running) return;
    if (!r) {
      view.innerHTML = EMPTY;
      return;
    }
    results.set(r.slug, r);
    view.innerHTML = renderResult(r);
  } catch (e) {
    if (mine !== running) return;
    view.innerHTML = `<div class="error"><p>${errorText(e).replace(/</g, '&lt;')}</p><button id="retry">Try again</button></div>`;
    $('retry').addEventListener('click', () => run(true));
  }
}

/** Re-run when the active tab moves to a different profile. LinkedIn navigates without reloading. */
function followTabs() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const check = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if ((await activeProfileSlug()) !== shownSlug) run();
    }, 400);
  };
  browser.tabs.onActivated.addListener(check);
  browser.tabs.onUpdated.addListener((_id, info, tab) => {
    if (tab.active && (info.url || info.status === 'complete')) check();
  });
}

/**
 * Tell the background this window's panel is open, so the toolbar button can
 * close it. Reconnects if the service worker restarts.
 */
async function announcePanel() {
  if (!(browser as any).sidePanel) return; // Chrome only; Firefox/Safari toggle natively.
  const win = await browser.windows.getCurrent().catch(() => null);
  if (!win?.id) return;
  const connect = () => {
    let port: Browser.runtime.Port;
    try {
      port = browser.runtime.connect({ name: `panel:${win.id}` });
    } catch {
      return; // extension was reloaded or removed; this page is orphaned
    }
    port.onMessage.addListener((msg) => {
      if (msg === 'close') window.close();
    });
    port.onDisconnect.addListener(() => setTimeout(connect, 250));
  };
  connect();
}

export function mountPanel() {
  document.body.innerHTML = MARKUP;
  $('rerun').addEventListener('click', () => run(true));
  followTabs();
  announcePanel();
  run();
}

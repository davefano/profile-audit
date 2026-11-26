// The extension UI. Mounted by the Chrome side panel, the Firefox sidebar, and
// the Safari popup (Safari has no sidebar API).

import { errorText } from '@/lib/runtime';
import { activeProfileSlug, auditActiveProfile, type AuditResult } from '@/lib/audit/run';
import { getSettings, onSettingsChanged } from '@/lib/settings';
import { paintDither, watchDither } from './dither';
import { applyMirroredPalette, applyPalette } from './palettes';
import { bindSettings, refreshSettings, SETTINGS_MARKUP } from './settings';
import { renderResult } from './views';
import './panel.css';

/** The toolbar icon's checkmark in a rounded square, in the accent colour. */
const LOGO = `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="2.5" y="2.5" width="27" height="27" rx="6.5" fill="currentColor" opacity=".14"/><rect x="2.5" y="2.5" width="27" height="27" rx="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="m9.5 16.5 4.5 4.5 8.5-9.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const MARKUP = `
<header class="top">
  <div class="brand">
    <span class="mark">${LOGO}</span>
    <div class="brand-text">
      <div class="title">Profile Audit</div>
      <div class="subtitle" id="subtitle">Side Panel</div>
    </div>
    <button class="icon-btn" id="rerun" title="Audit again" aria-label="Audit again">
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16.5 10a6.5 6.5 0 1 1-2-4.7M16.5 3.5v3.8h-3.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <button class="icon-btn" id="settingsBtn" title="Settings" aria-label="Settings" aria-pressed="false">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.75"/></svg>
    </button>
  </div>
</header>

<main>
  <section id="view-audit" class="view active" aria-live="polite">
    <div id="state-loading" class="hidden" aria-busy="true">
      <div class="skel-hero"><div class="skel av"></div><div class="skel-lines"><div class="skel w70"></div><div class="skel w90"></div></div></div>
      <div class="skel-lvl"><div class="skel tg"></div><div class="skel-lines"><div class="skel head w70"></div><div class="skel w90"></div></div></div>
      <div class="skel-bal"><div class="skel w40"></div><div class="skel gauge"></div><div class="skel w40"></div><div class="skel gauge"></div></div>
      <div class="skel-list"><div class="skel w90"></div><div class="skel w70"></div><div class="skel w90"></div></div>
      <p class="loading-step" role="status">Reading the profile…</p>
    </div>

    <div id="state-empty" class="hidden">
      <div class="empty">
        <svg class="empty-art" viewBox="0 0 120 96" aria-hidden="true">
          <rect x="14" y="14" width="76" height="62" rx="4" fill="var(--raised)" stroke="var(--line2)" stroke-width="2"/>
          <rect x="26" y="28" width="20" height="20" rx="2" fill="var(--line2)"/>
          <rect x="54" y="30" width="26" height="5" rx="1" fill="var(--line2)"/>
          <rect x="54" y="41" width="18" height="5" rx="1" fill="var(--line2)"/>
          <rect x="26" y="58" width="52" height="5" rx="1" fill="var(--line2)"/>
          <circle cx="86" cy="62" r="14" fill="var(--bg)" stroke="var(--accent)" stroke-width="3.5"/>
          <path d="m79.5 62.5 4.5 4.5 8.5-9" fill="none" stroke="var(--accent)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <h2>Open a LinkedIn profile</h2>
        <p>Go to your own profile, or one you're helping with, on www.linkedin.com. This panel follows your tab and audits the profile you open.</p>
      </div>
    </div>

    <div id="state-error" class="hidden">
      <div class="empty error">
        <h2>Couldn't read this profile</h2>
        <p id="errorText"></p>
        <button id="retry" class="btn secondary">Try again</button>
      </div>
    </div>

    <div id="result" class="hidden"></div>
  </section>

  <section id="view-settings" class="view">${SETTINGS_MARKUP}</section>
</main>
`;

const $ = (id: string) => document.getElementById(id)!;
const STATES = ['state-loading', 'state-empty', 'state-error', 'result'] as const;

function showState(id: (typeof STATES)[number]) {
  for (const s of STATES) $(s).classList.toggle('hidden', s !== id);
}

function showResult(r: AuditResult) {
  $('result').innerHTML = renderResult(r);
  $('result').querySelectorAll<HTMLImageElement>('.avatar img').forEach((img) =>
    img.addEventListener('error', () => img.remove(), { once: true }),
  );
  showState('result');
  paintDither($('result'));
}

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
  if (!slug) return showState('state-empty');
  const cached = results.get(slug);
  if (cached && !force) return showResult(cached);
  showState('state-loading');
  $('rerun').classList.add('spinning');
  try {
    const r = await auditActiveProfile();
    if (mine !== running) return;
    if (!r) return showState('state-empty');
    results.set(r.slug, r);
    showResult(r);
  } catch (e) {
    if (mine !== running) return;
    $('errorText').textContent = errorText(e);
    showState('state-error');
  } finally {
    if (mine === running) $('rerun').classList.remove('spinning');
  }
}

function showView(name: 'audit' | 'settings') {
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + name));
  $('settingsBtn').setAttribute('aria-pressed', String(name === 'settings'));
  if (name === 'settings') refreshSettings();
}

async function applySettings() {
  applyPalette((await getSettings()).palette);
  paintDither();
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

export async function mountPanel() {
  applyMirroredPalette();
  document.body.innerHTML = MARKUP;
  // Safari shows this UI as a popup, not a side panel.
  if (location.pathname.includes('popup')) $('subtitle').remove();
  watchDither(document.body);
  bindSettings();
  onSettingsChanged(applySettings);
  await applySettings();
  $('rerun').addEventListener('click', () => {
    showView('audit');
    run(true);
  });
  $('retry').addEventListener('click', () => run(true));
  $('settingsBtn').addEventListener('click', () => showView($('view-settings').classList.contains('active') ? 'audit' : 'settings'));
  followTabs();
  announcePanel();
  run();
}

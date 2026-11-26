// HTML for an audit result, in Fake Profile Reporter's layout: identity, the
// level, the score gauges, the lists, what wasn't checked, and the footer.
// Pure: data in, HTML out, all text escaped. dither.ts draws the canvases after.

import { SECTION_LABELS, type AuditReport, type Finding } from '@profile-audit/core/audit';
import type { AuditResult } from '@/lib/audit/run';
import { ago, esc, plural } from './format';

type Level = NonNullable<AuditReport['level']>;

const TITLE: Record<Level, string> = { standout: 'Standout profile', strong: 'Strong profile', good: 'Good, with room to grow', needs_work: 'Needs work' };
/** The palette token each level is drawn in. */
const TONE: Record<Level, string> = { standout: 'ok', strong: 'ok', good: 'accent', needs_work: 'warn' };

function identity(r: AuditResult) {
  const name = r.name ?? r.slug;
  const url = r.photoUrl && /^https:\/\//.test(r.photoUrl) ? r.photoUrl : null;
  return `<article class="hero">
    <div class="avatar" aria-hidden="true"><canvas class="pxav" data-seed="${esc(name)}"></canvas>${url ? `<img src="${esc(url)}" alt="" referrerpolicy="no-referrer">` : ''}</div>
    <div class="who">
      <h1 class="name">${esc(name)}</h1>
      ${r.headline ? `<p class="headline">${esc(r.headline)}</p>` : ''}
    </div>
  </article>`;
}

function assessment({ score, level }: AuditReport, improve: Finding[], bonusLeft: Finding[], notChecked: Finding[]) {
  const tone = level ? TONE[level] : 'text3';
  const lead = !level
    ? "None of the rules could be checked, because the profile didn't load."
    : improve.length
      ? `${plural(improve.length, 'suggestion')}, most important first.`
      : bonusLeft.length
        ? 'Every core rule passes. The bonus items below would make it stand out.'
        : 'Every rule that could be checked passes, bonus items included.';
  const skipped = level && notChecked.length ? ` ${plural(notChecked.length, 'rule')} couldn't be checked and don't count.` : '';
  return `<section class="lvl" style="--c: var(--${tone})">
    <canvas class="wash" data-c="${tone}" aria-hidden="true"></canvas>
    <span class="tag" aria-hidden="true">${score ?? '–'}</span>
    <h2>${level ? TITLE[level] : 'Nothing could be checked'}</h2>
    <p>${esc(lead + skipped)}</p>
  </section>`;
}

/** Two dithered gauges: the score, and the rules passed of those checked. */
function balance({ score, level }: AuditReport, passed: number, checked: number) {
  if (score == null || !level) return '';
  const row = (label: string, value: string, frac: number, tone: string) => `<div class="bal-row">
      <div class="top-l" aria-hidden="true"><span>${label}</span><b style="color: var(--${tone})">${value}</b></div>
      <canvas class="dz" data-frac="${Math.round(frac * 1000) / 1000}" data-c="${tone}" role="img" aria-label="${esc(`${label}: ${value}`)}"></canvas>
    </div>`;
  return `<div class="bal">${row('Score', `${score}/100`, score / 100, TONE[level])}${row('Rules passed', `${passed} of ${checked}`, passed / checked, 'ok')}</div>`;
}

function heading(title: string, count?: number | string) {
  return `<h3>${esc(title)}<span class="rule" aria-hidden="true"></span><small>${count ?? ''}</small></h3>`;
}

/** ✓ passes, ↑ a suggestion, + a bonus still to add. */
function item(f: Finding) {
  const mark = f.status === 'pass' ? '✓' : f.bonus ? '+' : '↑';
  const tip = f.status === 'improve' && f.tip ? `<span class="tip">${esc(f.tip)}</span>` : '';
  return `<li class="${f.status}${f.weight >= 3 ? ' major' : ''}"><span class="mk" aria-hidden="true">${mark}</span><span class="t">${esc(f.title)}<span class="why">${esc(f.detail)}</span></span><span class="str">${esc(SECTION_LABELS[f.section])}</span>${tip}</li>`;
}

function list(cls: string, title: string, items: Finding[], none: string, count: number | string = items.length) {
  return `<section class="col ${cls}">${heading(title, count)}${
    items.length ? `<ul>${items.map(item).join('')}</ul>` : `<p class="none">${none}</p>`
  }</section>`;
}

function notCheckedLine(items: Finding[]) {
  if (!items.length) return '';
  return `<p class="nc"><span class="mk" aria-hidden="true">–</span>Not checked: ${esc(items.map((f) => f.title).join('; '))}. Their data didn't load, so they're left out of the score.</p>`;
}

function readNotes(errors: Record<string, string>) {
  const failed = Object.entries(errors);
  if (!failed.length) return '';
  return `<section class="sec notes">${heading('About this read')}<ul><li>${esc(`Failed to load: ${failed.map(([k, v]) => `${k} (${v})`).join('; ')}`)}</li></ul></section>`;
}

export function renderResult(r: AuditResult): string {
  const { findings } = r.report;
  const core = findings.filter((f) => !f.bonus);
  const improve = core.filter((f) => f.status === 'improve').sort((a, b) => b.weight - a.weight);
  const passed = core.filter((f) => f.status === 'pass');
  const bonus = findings.filter((f) => f.bonus && f.status !== 'not_checked').sort((a, b) => (a.status === 'pass' ? 1 : 0) - (b.status === 'pass' ? 1 : 0));
  const bonusLeft = bonus.filter((f) => f.status === 'improve');
  const notChecked = findings.filter((f) => f.status === 'not_checked');
  return `${identity(r)}
  ${assessment(r.report, improve, bonusLeft, notChecked)}
  ${balance(r.report, passed.length, passed.length + improve.length)}
  ${list('improve', 'Suggestions', improve, 'Nothing to improve on the rules that could be checked')}
  ${bonus.length ? list('bonus', 'Bonus', bonus, '', `${bonus.length - bonusLeft.length} of ${bonus.length}`) : ''}
  ${list('pass', 'Looks good', passed, 'No rule passes yet')}
  ${notCheckedLine(notChecked)}
  ${readNotes(r.errors)}
  <p class="foot"><span>Read ${ago(r.capturedAt)} · rules of thumb, not LinkedIn requirements</span></p>`;
}

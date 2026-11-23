// Markup for an audit result. Pure: data in, HTML out.

import { SECTION_LABELS, type AuditReport, type Finding, type Section } from '@profile-audit/core/audit';
import type { AuditResult } from '@/lib/audit/run';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const LEVEL_LABELS: Record<NonNullable<AuditReport['level']>, string> = {
  strong: 'Strong profile',
  good: 'Good, with room to grow',
  needs_work: 'Needs work',
};

const MARK: Record<Finding['status'], string> = { pass: '✓', improve: '↑', not_checked: '–' };

function finding(f: Finding): string {
  return `
    <li class="finding ${f.status}">
      <span class="mark" aria-hidden="true">${MARK[f.status]}</span>
      <div>
        <div class="finding-title">${esc(f.title)}</div>
        <div class="finding-detail">${esc(f.detail)}</div>
        ${f.tip ? `<div class="finding-tip">${esc(f.tip)}</div>` : ''}
      </div>
    </li>`;
}

/** Findings grouped by section, in the order the rules declare them. */
function bySection(findings: Finding[]): Array<[Section, Finding[]]> {
  const groups = new Map<Section, Finding[]>();
  for (const f of findings) groups.set(f.section, [...(groups.get(f.section) ?? []), f]);
  return [...groups];
}

function group(title: string, findings: Finding[], open: boolean): string {
  if (!findings.length) return '';
  return `
    <details class="group" ${open ? 'open' : ''}>
      <summary>${esc(title)} <span class="count">${findings.length}</span></summary>
      ${bySection(findings)
        .map(([section, list]) => `<h3>${esc(SECTION_LABELS[section])}</h3><ul>${list.map(finding).join('')}</ul>`)
        .join('')}
    </details>`;
}

export function renderResult(r: AuditResult): string {
  const { score, level, findings } = r.report;
  const improve = findings.filter((f) => f.status === 'improve').sort((a, b) => b.weight - a.weight);
  const passed = findings.filter((f) => f.status === 'pass');
  const notChecked = findings.filter((f) => f.status === 'not_checked');
  return `
    <div class="hero">
      ${r.photoUrl ? `<img class="avatar" src="${esc(r.photoUrl)}" alt="" />` : '<div class="avatar"></div>'}
      <div>
        <div class="name">${esc(r.name ?? r.slug)}</div>
        ${r.headline ? `<div class="headline">${esc(r.headline)}</div>` : ''}
      </div>
    </div>
    <div class="score ${level ?? ''}">
      <div class="num">${score ?? '–'}</div>
      <div>
        <div class="level">${level ? LEVEL_LABELS[level] : 'Nothing could be checked'}</div>
        <div class="sub">${improve.length ? `${improve.length} suggestion${improve.length === 1 ? '' : 's'}, most important first` : 'No suggestions'}</div>
      </div>
    </div>
    ${group('Suggestions', improve, true)}
    ${group('Looks good', passed, false)}
    ${group('Not checked', notChecked, false)}
    <p class="foot">Rules of thumb, not LinkedIn requirements. Read ${new Date(r.capturedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.</p>`;
}

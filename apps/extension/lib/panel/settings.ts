// Settings: Appearance, the palette cards. Copied from Fake Profile Reporter's panel.

import { getSettings, updateSettings } from '@/lib/settings';
import { esc } from './format';
import { applyPalette, isPaletteChoice, PALETTES, SYSTEM_PALETTE, type PaletteTokens } from './palettes';

const PAPER = PALETTES.find((p) => p.id === SYSTEM_PALETTE.light)!.tokens;
const SLATE = PALETTES.find((p) => p.id === SYSTEM_PALETTE.dark)!.tokens;

/** A small preview: the background, three lines of text, and accent, warn and ok dots. */
function swatch(bg: string, text: PaletteTokens, dots: [string, string, string]) {
  const line = (c: string, w: number) => `<i style="background:${c};width:${w}%"></i>`;
  return `<span class="sw" style="background:${bg}" aria-hidden="true"><span class="lines">${line(text.text, 70)}${line(text.text3, 90)}${line(text.text3, 55)}</span><span class="dots">${dots.map((c) => `<i style="background:${c}"></i>`).join('')}</span></span>`;
}

function paletteCard(value: string, preview: string, name: string, description: string, source: string) {
  return `<label class="pal"><input type="radio" name="palette" value="${value}" />${preview}<b>${esc(name)}</b><small>${esc(description)}</small><span class="src">${esc(source)}</span></label>`;
}

const PALETTE_CARDS = [
  paletteCard(
    SYSTEM_PALETTE.id,
    swatch(`linear-gradient(135deg, ${PAPER.bg} 0 50%, ${SLATE.bg} 50% 100%)`, PAPER, [SLATE.accent, PAPER.warn, SLATE.ok]),
    SYSTEM_PALETTE.name,
    SYSTEM_PALETTE.description,
    SYSTEM_PALETTE.source,
  ),
  ...PALETTES.map((p) => paletteCard(p.id, swatch(p.tokens.bg, p.tokens, [p.tokens.accent, p.tokens.warn, p.tokens.ok]), p.name, p.description, p.source)),
].join('');

export const SETTINGS_MARKUP = `
<div class="set">
  <h2>Settings</h2>
  <section class="sec" aria-labelledby="setAppearance">
    <h3 id="setAppearance">Appearance<span class="rule" aria-hidden="true"></span><small></small></h3>
    <div class="pals" role="radiogroup" aria-labelledby="setAppearance">${PALETTE_CARDS}</div>
  </section>
</div>`;

/** Tick the saved palette. Call when the view opens. */
export async function refreshSettings() {
  const s = await getSettings();
  document.querySelectorAll<HTMLInputElement>('input[name="palette"]').forEach((r) => (r.checked = r.value === s.palette));
}

export function bindSettings() {
  document.querySelectorAll<HTMLInputElement>('input[name="palette"]').forEach((r) =>
    r.addEventListener('change', () => {
      if (!isPaletteChoice(r.value)) return;
      applyPalette(r.value);
      updateSettings({ palette: r.value });
    }),
  );
}

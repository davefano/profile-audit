import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { avatarCells } from '../lib/panel/dither';
import { PALETTES, type PaletteTokens } from '../lib/panel/palettes';

// WCAG 2 relative luminance and contrast ratio.
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

// Every foreground the panel sets small text in, on every surface it sits on.
const FOREGROUNDS: (keyof PaletteTokens)[] = ['text', 'text2', 'text3', 'accent', 'flag', 'ok', 'warn'];
const SURFACES: (keyof PaletteTokens)[] = ['bg', 'raised'];
const PAIRS: [keyof PaletteTokens, keyof PaletteTokens][] = FOREGROUNDS.flatMap((fg) => SURFACES.map((bg) => [fg, bg] as [keyof PaletteTokens, keyof PaletteTokens]));

describe('palettes', () => {
  test.each(PALETTES.map((p) => [p.name, p] as const))('%s: small text meets 4.5:1', (_name, p) => {
    const failing = PAIRS.map(([fg, bg]) => [`${fg} on ${bg}`, contrast(p.tokens[fg], p.tokens[bg])] as const).filter(([, r]) => r < 4.5);
    expect(failing).toEqual([]);
  });

  test('panel.css carries the same tokens as palettes.ts', () => {
    const css = readFileSync(join(import.meta.dir, '../lib/panel/panel.css'), 'utf8');
    for (const p of PALETTES) {
      const block = css.match(new RegExp(`:root\\[data-palette="${p.id}"\\][^{]*\\{([^}]*)\\}`))?.[1];
      expect(block, `no CSS block for ${p.id}`).toBeDefined();
      const tokens = Object.fromEntries([...block!.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map(([, k, v]) => [k, v!.toLowerCase()]));
      expect(tokens).toEqual({ ...p.tokens });
    }
  });

  test('Match my system uses Paper by day and Slate at night', () => {
    const css = readFileSync(join(import.meta.dir, '../lib/panel/panel.css'), 'utf8');
    const tokensOf = (re: RegExp) => Object.fromEntries([...(css.match(re)?.[1] ?? '').matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map(([, k, v]) => [k, v!.toLowerCase()]));
    const byId = (id: string) => ({ ...PALETTES.find((p) => p.id === id)!.tokens });
    expect(tokensOf(/^:root, :root\[data-palette="paper"\] \{([^}]*)\}/m)).toEqual(byId('paper'));
    expect(tokensOf(/:root:not\(\[data-palette\]\), :root\[data-palette="system"\] \{([^}]*)\}/)).toEqual(byId('slate'));
  });
});

describe('getSettings', () => {
  test('defaults the palette to Match my system', async () => {
    (globalThis as any).browser = { storage: { local: { get: async () => ({}) } } };
    try {
      const { getSettings } = await import('../lib/settings');
      expect((await getSettings()).palette).toBe('system');
    } finally {
      delete (globalThis as any).browser;
    }
  });
});

describe('pixel avatar', () => {
  const pattern = (name: string) => avatarCells(name).map((row) => row.map((on) => (on ? '#' : '.')).join('')).join('\n');

  test('the same name gives the same mirrored 5×5 face', () => {
    const face = avatarCells('Sam Q.');
    expect(face).toHaveLength(5);
    for (const row of face) {
      expect(row).toHaveLength(5);
      expect(row).toEqual([...row].reverse());
    }
    expect(pattern('Sam Q.')).toBe(pattern('Sam Q.'));
  });

  test('different names usually give different faces', () => {
    const names = ['Sam Q.', 'Olivia Brandt', 'Priya Natarajan', 'Example Person', 'Alex Doe', 'Jordan Lee', 'Taylor Kim', 'Morgan Park'];
    expect(new Set(names.map(pattern)).size).toBeGreaterThanOrEqual(names.length - 1);
  });
});

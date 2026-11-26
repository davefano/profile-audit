// The panel's colour palettes. The token values here are the source the CSS
// blocks in panel.css copy (test/palettes.test.ts keeps them in step and checks
// small-text contrast). Omarchy theme colour names aren't meanings, so the
// themes supply backgrounds, text and accent; flag, ok and warn are ours.

export type PaletteId = 'paper' | 'slate' | 'midnight' | 'charcoal' | 'ink';
export type PaletteChoice = 'system' | PaletteId;

export interface PaletteTokens {
  bg: string;
  raised: string;
  deep: string;
  line: string;
  line2: string;
  text: string;
  text2: string;
  text3: string;
  accent: string;
  flag: string;
  ok: string;
  warn: string;
  'on-accent': string;
}

export interface Palette {
  id: PaletteId;
  name: string;
  description: string;
  /** Where the colours come from, shown small under the description. */
  source: string;
  scheme: 'light' | 'dark';
  tokens: PaletteTokens;
}

export const PALETTES: readonly Palette[] = [
  {
    id: 'paper',
    name: 'Paper',
    description: 'Warm off-white, ink-dark text',
    source: 'Omarchy Flexoki Light',
    scheme: 'light',
    // text3, ok and warn are darker than Flexoki's own so small text reaches 4.5:1 on raised.
    tokens: { bg: '#fffcf0', raised: '#f2f0e5', deep: '#e6e4d9', line: '#e6e4d9', line2: '#cecdc3', text: '#100f0f', text2: '#403e3c', text3: '#66655f', accent: '#205ea6', flag: '#af3029', ok: '#536907', warn: '#7a5e01', 'on-accent': '#fffcf0' },
  },
  {
    id: 'slate',
    name: 'Slate',
    description: 'Deep blue-grey, pale blue accent',
    source: 'Omarchy Lumon',
    scheme: 'dark',
    tokens: { bg: '#16242d', raised: '#1b2d40', deep: '#101b21', line: '#243d56', line2: '#304860', text: '#f2fcff', text2: '#d6e2ee', text3: '#93b6d1', accent: '#8bc9eb', flag: '#ff8f94', ok: '#90dbab', warn: '#f0c26a', 'on-accent': '#101b21' },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Blue-black, periwinkle accent',
    source: 'Omarchy Tokyo Night',
    scheme: 'dark',
    // text3 is lighter than the theme's so small text reaches 4.5:1 on raised.
    tokens: { bg: '#1a1b26', raised: '#24283b', deep: '#13141c', line: '#292e42', line2: '#414868', text: '#c0caf5', text2: '#a9b1d6', text3: '#8a92bb', accent: '#7aa2f7', flag: '#ff7a85', ok: '#8fd9a2', warn: '#e0af68', 'on-accent': '#13141c' },
  },
  {
    id: 'charcoal',
    name: 'Charcoal',
    description: 'Neutral black, amber accent',
    source: 'Omarchy Matte Black',
    scheme: 'dark',
    tokens: { bg: '#121212', raised: '#1e1e1e', deep: '#0d0d0d', line: '#2a2a2a', line2: '#3a3a3a', text: '#e4e4e4', text2: '#bebebe', text3: '#8a8a8d', accent: '#e68e0d', flag: '#ff7a72', ok: '#8fd99b', warn: '#e6b94d', 'on-accent': '#121212' },
  },
  {
    id: 'ink',
    name: 'Ink',
    description: 'Near-black, bright blue accent',
    source: 'After dither-kit',
    scheme: 'dark',
    tokens: { bg: '#0f0f10', raised: '#18181a', deep: '#0a0a0b', line: '#232326', line2: '#34343a', text: '#ededee', text2: '#b9b9bf', text3: '#8b8b93', accent: '#3d9bff', flag: '#ff6b7d', ok: '#5fe0a0', warn: '#ffb54d', 'on-accent': '#0a0a0b' },
  },
];

/** "Match my system": Paper by day, Slate at night. */
export const SYSTEM_PALETTE = {
  id: 'system',
  name: 'Match my system',
  description: 'Paper by day, Slate at night',
  source: 'Follows your computer',
  light: 'paper',
  dark: 'slate',
} as const satisfies { id: 'system'; light: PaletteId; dark: PaletteId; name: string; description: string; source: string };

export const isPaletteChoice = (v: unknown): v is PaletteChoice => v === 'system' || PALETTES.some((p) => p.id === v);

// A synchronous copy of Settings › palette, read before the panel mounts so it
// never paints in the wrong palette while browser.storage answers.
const MIRROR_KEY = 'profile-audit.palette';

/** Set the palette on the page and remember it for the next open. */
export function applyPalette(choice: PaletteChoice) {
  document.documentElement.dataset.palette = choice;
  try {
    localStorage.setItem(MIRROR_KEY, choice);
  } catch {}
}

/** Apply the remembered palette, if any. Call before mounting. */
export function applyMirroredPalette() {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(MIRROR_KEY);
  } catch {}
  if (isPaletteChoice(saved)) document.documentElement.dataset.palette = saved;
}

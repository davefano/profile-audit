// Ordered-dither drawing for the panel: the score gauges, the wash behind the
// level, and the pixel avatar. Colours come from the palette's CSS tokens, so
// everything here repaints when the palette, the colour scheme or the width
// changes. Views mark canvases up; this module only draws them:
//   <canvas class="dz" data-frac="0.4" data-c="ok">   a gauge filled to 40%
//   <canvas class="wash" data-c="warn">               the level wash
//   <canvas class="pxav" data-seed="Name">            the pixel avatar
// Copied from Fake Profile Reporter's panel, with the wash keyed on a token.

/** Values tuned in Fake Profile Reporter's prototype. */
const DOT = 2; // one dither dot, in CSS px
const GAUGE_FADE = 0.25; // how far the fill thins toward its end
const GAUGE_EMPTY = 0.12; // density of the unfilled track
const WASH = { density: 1, reach: 0.3, opacity: 0.35 };

// 4×4 Bayer matrix: a dot is lit when its threshold is under the local density.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const lit = (x: number, y: number, density: number) => BAYER[(y % 4) * 4 + (x % 4)]! < density;

/** A mirrored 5×5 face from a name: the same name always gives the same face. */
export function avatarCells(seed: string): boolean[][] {
  let h = 2166136261; // FNV-1a
  for (const ch of seed) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return Array.from({ length: 5 }, (_, y) => {
    const half = [0, 1, 2].map((x) => ((h >>> (y * 3 + x)) & 1) === 1);
    return [...half, half[1]!, half[0]!];
  });
}

/** Size a canvas to one pixel per dither dot and return its context. */
function sized(c: HTMLCanvasElement) {
  c.width = Math.max(1, Math.round(c.clientWidth / DOT));
  c.height = Math.max(1, Math.round(c.clientHeight / DOT));
  return c.getContext('2d');
}

function paintGauge(c: HTMLCanvasElement, col: (token: string) => string) {
  const g = sized(c);
  if (!g) return;
  const { width: W, height: H } = c;
  const fill = Math.round(W * Math.min(1, Math.max(0, Number(c.dataset.frac) || 0)));
  g.fillStyle = col(c.dataset.c ?? 'text');
  for (let x = 0; x < fill; x++) {
    const d = 1 - GAUGE_FADE * (x / Math.max(1, fill)); // dense at the start, thinning out
    for (let y = 0; y < H; y++) if (lit(x, y, d)) g.fillRect(x, y, 1, 1);
  }
  g.fillStyle = col('line2');
  for (let x = fill; x < W; x++) for (let y = 0; y < H; y++) if (lit(x, y, GAUGE_EMPTY)) g.fillRect(x, y, 1, 1);
}

function paintWash(c: HTMLCanvasElement, col: (token: string) => string) {
  const g = sized(c);
  if (!g) return;
  const { width: W, height: H } = c;
  g.fillStyle = col(c.dataset.c ?? 'text3');
  g.globalAlpha = WASH.opacity;
  const { density, reach } = WASH;
  // Top-right corner only, clear of the sentence under the heading. Outside it
  // the density is 0 and nothing lights, so the loops skip the rest.
  for (let y = 0; y < Math.min(H, Math.ceil(H * reach)); y++)
    for (let x = Math.max(0, Math.floor(W * (1 - reach))); x < W; x++) {
      const d = density * Math.max(0, 1 - y / (H * reach)) * Math.max(0, (x / W - (1 - reach)) / reach);
      if (lit(x, y, d)) g.fillRect(x, y, 1, 1);
    }
}

function paintAvatar(c: HTMLCanvasElement, col: (token: string) => string) {
  c.width = c.height = 10;
  const g = c.getContext('2d');
  if (!g) return;
  g.fillStyle = col('raised');
  g.fillRect(0, 0, 10, 10);
  g.fillStyle = col('accent');
  avatarCells(c.dataset.seed ?? '').forEach((row, y) => row.forEach((on, x) => on && g.fillRect(x * 2, y * 2, 2, 2)));
}

/** Draw every dithered canvas under root from the current palette. */
export function paintDither(root: ParentNode = document) {
  const css = getComputedStyle(document.documentElement);
  const col = (token: string) => css.getPropertyValue('--' + token).trim();
  root.querySelectorAll<HTMLCanvasElement>('canvas.dz').forEach((c) => paintGauge(c, col));
  root.querySelectorAll<HTMLCanvasElement>('canvas.wash').forEach((c) => paintWash(c, col));
  root.querySelectorAll<HTMLCanvasElement>('canvas.pxav').forEach((c) => paintAvatar(c, col));
}

/**
 * Repaint when the panel is resized (the side panel is) or the system colour
 * scheme flips (Match my system). Palette changes call paintDither directly.
 */
export function watchDither(root: HTMLElement) {
  let width = root.clientWidth;
  let frame = 0;
  const repaint = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => paintDither(root));
  };
  const resize = new ResizeObserver(() => {
    if (root.clientWidth === width) return; // content height changes don't move the dots
    width = root.clientWidth;
    repaint();
  });
  resize.observe(root);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', repaint);
}

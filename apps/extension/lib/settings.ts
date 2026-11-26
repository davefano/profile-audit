// The member's preferences, kept in this browser's extension storage.

import type { PaletteChoice } from '@/lib/panel/palettes';

export interface Settings {
  /** Settings › Appearance. */
  palette: PaletteChoice;
}

const KEY = 'settings';
const DEFAULTS: Settings = { palette: 'system' };

export async function getSettings(): Promise<Settings> {
  const raw = (await browser.storage.local.get(KEY))[KEY] as Partial<Settings> | undefined;
  return { ...DEFAULTS, ...raw };
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await browser.storage.local.set({ [KEY]: next });
  return next;
}

export const onSettingsChanged = (fn: () => void) =>
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && KEY in changes) fn();
  });

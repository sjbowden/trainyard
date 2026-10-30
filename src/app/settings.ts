/** Per-device preferences, kept in localStorage (a convenience: failures fall back to defaults). */

export interface Settings {
  /** Show the Solved! card after a win; when off, the next puzzle opens by itself. */
  showSolvedCard: boolean;
}

const KEY = 'trainyard.settings';
const DEFAULTS: Settings = { showSolvedCard: true };

export function loadSettings(): Settings {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // ignore: the setting lasts for this session only
  }
}

/** Per-device preferences, kept in localStorage (a convenience: failures fall back to defaults). */

export interface Settings {
  /** Show the Solved! card after a win; when off, the next puzzle opens by itself. */
  showSolvedCard: boolean;
  /** The speed slider's position (0.1–1), kept from puzzle to puzzle. */
  speed: number;
  /** The board style. Original needs the art kept from the APK; without it the default shows. */
  theme: 'default' | 'original';
  /** How the player puzzle library's difficulty lists are sorted. */
  librarySort: 'likes' | 'solves';
  /** Leave solved puzzles out of the player puzzle lists and search, and out of Next. */
  hideSolved: boolean;
}

const KEY = 'trainyard.settings';
const DEFAULTS: Settings = { showSolvedCard: true, speed: 0.5, theme: 'default', librarySort: 'likes', hideSolved: false };

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

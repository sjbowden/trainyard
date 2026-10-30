/** Which cities' tutorials have been shown, kept per device (a convenience, so failures are ignored). */

const KEY = 'trainyard.tutorialsSeen';

export function tutorialSeen(id: string): boolean {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]).includes(id);
  } catch {
    return true;
  }
}

export function markTutorialSeen(id: string): void {
  try {
    const seen = JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[];
    localStorage.setItem(KEY, JSON.stringify([...new Set([...seen, id])]));
  } catch {
    // ignore
  }
}

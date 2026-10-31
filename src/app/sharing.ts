import { shareUrl } from './share.ts';

/** Shares a puzzle link through the iPhone share sheet, or copies it. Returns a message to show, if any. */
export async function sharePuzzle(name: string, code: string): Promise<string | null> {
  const url = shareUrl({ name, code });
  try {
    if (navigator.share) {
      await navigator.share({ title: `Trainyard: ${name}`, url });
      return null;
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') return null;
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'Link copied.';
  } catch {
    return url;
  }
}

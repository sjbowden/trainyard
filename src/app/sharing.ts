import type { Progress } from './progress.ts';
import { progressFileName, progressFileText } from './progressFile.ts';
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

/** Hands a progress file to the share sheet (Save to Files), or downloads it where there's no share sheet. */
export async function saveProgressFile(p: Progress): Promise<void> {
  const file = new File([progressFileText(p)], progressFileName(), { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (err) {
      if ((err as Error).name === 'AbortError') return; // closing the share sheet without saving is fine
      // any other failure: download it instead
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

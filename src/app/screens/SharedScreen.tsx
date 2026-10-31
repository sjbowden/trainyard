import { useEffect, useState } from 'preact/hooks';
import { addShared, customKey, sharedId, type CustomPuzzle } from '../customPuzzles.ts';
import type { Progress } from '../progress.ts';
import { buildRoute } from '../router.ts';
import { shareUrl, type SharedPuzzle } from '../share.ts';
import { isInstalledApp } from '../sharedLinks.ts';
import { PuzzleScreen } from './PuzzleScreen.tsx';
import type { Theme } from '../theme/theme.ts';

/** A link that couldn't be read. */
export function LinkProblem({ message }: { message: string }) {
  return (
    <main class="screen">
      <h1>Trainyard</h1>
      <p class="notice">{message}</p>
      <a class="button primary" href={buildRoute({ name: 'home' })}>Home</a>
    </main>
  );
}

export interface SharedScreenProps {
  puzzle: SharedPuzzle;
  progress: Progress;
  onResult: (key: string, solution: string, solved: boolean) => void;
  onAdded: (p: CustomPuzzle) => void;
  theme?: Theme;
}

/**
 * A shared puzzle. In the installed app it is added to "Shared with me" and opened. In Safari it
 * is playable here, with a button that copies the link for pasting into the app (iOS doesn't let
 * the app read the clipboard by itself).
 */
export function SharedScreen({ puzzle, progress, onResult, onAdded, theme }: SharedScreenProps) {
  const installed = isInstalledApp();
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    if (installed) void addShared(puzzle).then(onAdded);
  }, [installed, puzzle.code]);
  if (installed) return <main class="screen" />;

  const key = customKey(sharedId(puzzle.code));
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl(puzzle));
      setCopied('Link copied. Open Trainyard from your home screen, go to My puzzles, and tap Paste puzzle link.');
    } catch {
      setCopied(`Copy this link, then paste it in Trainyard under My puzzles: ${shareUrl(puzzle)}`);
    }
  };
  return (
    <PuzzleScreen
      key={key}
      title={puzzle.name}
      stars={0}
      puzzleCode={puzzle.code}
      savedSolution={progress.levels[key]?.solution ?? ''}
      onResult={(solution, solved) => onResult(key, solution, solved)}
      onBack={() => (location.hash = buildRoute({ name: 'home' }))}
      theme={theme}
    >
      <div class="add-banner">
        <button class="wide" onClick={() => void copy()}>Add to my app</button>
        {copied && <p class="muted">{copied}</p>}
      </div>
    </PuzzleScreen>
  );
}

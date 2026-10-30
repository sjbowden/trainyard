import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { decodeBoard } from '../../engine/codec.ts';
import type { HalfStepEvents } from '../../engine/sim.ts';
import type { Board } from '../../engine/types.ts';
import { speedFromSlider } from '../board/animation.ts';
import { BoardCanvas } from '../board/BoardCanvas.tsx';
import { deliveredColors, PuzzleController, type Finish } from '../board/player.ts';
import { DebouncedSave } from '../saver.ts';
import type { DrawnEffect } from '../board/render.ts';
import { defaultTheme } from '../theme/default.ts';
import { unlockAudio } from '../theme/sound.ts';
import type { Theme } from '../theme/theme.ts';

export interface PuzzleScreenProps {
  title: string;
  stars: number;
  puzzleCode: string;
  savedSolution: string;
  onResult(solution: string, solved: boolean): void;
  onBack(): void;
  onNext?: () => void;
  theme?: Theme;
  /** Shown above the board, e.g. tutorial text. */
  children?: preact.ComponentChildren;
}

const MESSAGES: Record<Exclude<Finish, 'won'>, string> = {
  crashed: 'Crashed!',
  stalled: 'The trains stopped before every goal was filled.',
  stopped: 'Stopped: the trains would never finish.',
};

function initialBoard(code: string, solution: string): Board {
  if (solution) {
    try {
      return decodeBoard(`${code}_${solution}`);
    } catch {
      // A damaged saved solution: start from the bare puzzle.
    }
  }
  return decodeBoard(code);
}

export function PuzzleScreen({ title, stars, puzzleCode, savedSolution, onResult, onBack, onNext, theme = defaultTheme, children }: PuzzleScreenProps) {
  const [, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);
  const [mode, setMode] = useState<'draw' | 'erase'>('draw');
  const [slider, setSlider] = useState(0.5);
  const [finish, setFinish] = useState<Finish | null>(null);
  const effects = useRef<(DrawnEffect & { born: number })[]>([]);
  const results = useRef(onResult);
  results.current = onResult;

  const controller = useMemo(() => {
    const onEvents = (ev: HalfStepEvents) => {
      const born = performance.now();
      for (const cell of ev.crashes) effects.current.push({ kind: 'crash', cell, born, t: 0 });
      for (const cell of ev.painted) effects.current.push({ kind: 'paint', cell, born, t: 0 });
      for (const cell of ev.splits) effects.current.push({ kind: 'split', cell, born, t: 0 });
      for (const cell of ev.delivered) effects.current.push({ kind: 'deliver', cell, born, t: 0 });
      if (ev.crashes.length) theme.playSound('crash');
      if (ev.painted.length) theme.playSound('paint');
      if (ev.splits.length) theme.playSound('split');
      const run = c.playing?.run;
      if (run) for (const color of deliveredColors(run, ev.delivered)) theme.playSound('deliver', color);
      if (ev.switched.length) theme.playSound('switch');
    };
    const onFinish = (f: Finish) => {
      setFinish(f);
      if (f === 'won') {
        theme.playSound('win');
        results.current(c.solution, true);
      }
    };
    const c = new PuzzleController(initialBoard(puzzleCode, savedSolution), onFinish, onEvents);
    return c;
  }, [puzzleCode]);

  const saver = useMemo(() => new DebouncedSave<string>((solution) => results.current(solution, false), 500), [puzzleCode]);

  // Save a pending drawing at once when leaving the puzzle or when iOS backgrounds the app.
  useEffect(() => {
    const flush = () => saver.flush();
    const onVisibility = () => document.visibilityState === 'hidden' && flush();
    addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      flush();
    };
  }, [saver]);

  const edited = () => {
    refresh();
    saver.schedule(controller.solution);
  };

  const startStop = () => {
    unlockAudio();
    if (controller.running) {
      controller.stop();
      setFinish(null);
    } else {
      setFinish(null);
      effects.current = [];
      theme.playSound('start');
      controller.start();
    }
    refresh();
  };

  const act = (f: () => void) => () => {
    unlockAudio();
    f();
    edited();
  };

  return (
    <main class="screen puzzle">
      <header class="bar">
        <button onClick={onBack} aria-label="Back">‹</button>
        <h2>{title}</h2>
        <span class="stars">{'★'.repeat(Math.min(stars, 5))}{stars > 5 ? ` ${stars}` : ''}</span>
      </header>
      {children}
      <div class="board-wrap" onPointerDown={unlockAudio}>
        <BoardCanvas controller={controller} theme={theme} mode={mode} speed={speedFromSlider(slider)} effects={effects} onEdit={edited} />
        {finish === 'won' && (
          <div class="overlay">
            <div class="card">
              <h2>Solved!</h2>
              <p class="stars big">{'★'.repeat(Math.min(stars, 5))}{stars > 5 ? ` ${stars}` : ''}</p>
              <div class="row">
                <button onClick={onBack}>Back to city</button>
                {onNext && <button class="primary" onClick={onNext}>Next puzzle</button>}
              </div>
            </div>
          </div>
        )}
        {finish && finish !== 'won' && <div class="toast">{MESSAGES[finish]}</div>}
      </div>
      <div class="tools">
        <button class={mode === 'draw' ? 'on' : ''} disabled={controller.running} onClick={() => setMode(mode === 'draw' ? 'erase' : 'draw')}>
          {mode === 'draw' ? 'Draw' : 'Erase'}
        </button>
        <button disabled={!controller.canUndo} onClick={act(() => controller.undo())} aria-label="Undo">↶</button>
        <button disabled={!controller.canRedo} onClick={act(() => controller.redo())} aria-label="Redo">↷</button>
        <button disabled={controller.running} onClick={act(() => controller.clear())}>Clear</button>
        <button class="primary go" onClick={startStop}>{controller.running ? 'Stop' : 'Start'}</button>
      </div>
      <label class="speed">
        <span>Speed</span>
        <input type="range" min="0.1" max="1" step="0.01" value={slider} onInput={(e) => setSlider(Number((e.target as HTMLInputElement).value))} />
      </label>
    </main>
  );
}

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { decodeBoard, encodeBoard } from '../../engine/codec.ts';
import type { Board } from '../../engine/types.ts';
import { cellAt, fitBoard } from '../board/geometry.ts';
import { renderBoard } from '../board/render.ts';
import type { CustomPuzzle } from '../customPuzzles.ts';
import { placePiece, problems, proofHolds, updatePiece, type Tool } from '../editor.ts';
import { buildRoute } from '../router.ts';
import { DebouncedSave } from '../saver.ts';
import { sharePuzzle } from '../sharing.ts';
import { solveInWorker } from '../solverClient.ts';
import { defaultTheme } from '../theme/default.ts';
import { PieceSheet } from './PieceSheet.tsx';

const TOOLS: { tool: Tool; label: string }[] = [
  { tool: 'outlet', label: 'Outlet' },
  { tool: 'goal', label: 'Goal' },
  { tool: 'rock', label: 'Rock' },
  { tool: 'painter', label: 'Painter' },
  { tool: 'splitter', label: 'Splitter' },
  { tool: 'erase', label: 'Erase' },
];

/** A board you tap to place or pick pieces. */
function EditorBoard({ board, onTap }: { board: Board; onTap: (cell: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const draw = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderBoard(ctx, defaultTheme, fitBoard(width, height, board.cols, board.rows, 0), board, []);
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [board]);
  const tap = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const cell = cellAt(fitBoard(r.width, r.height, board.cols, board.rows, 0), e.clientX - r.left, e.clientY - r.top);
    if (cell !== null) onTap(cell);
  };
  return <canvas ref={ref} class="board" onPointerUp={tap} />;
}

export interface EditorScreenProps {
  puzzle: CustomPuzzle;
  onSave: (p: CustomPuzzle) => void;
  onTest: () => void;
  onDelete: () => void;
}

export function EditorScreen({ puzzle, onSave, onTest, onDelete }: EditorScreenProps) {
  const [board, setBoard] = useState<Board>(() => decodeBoard(puzzle.code));
  const [name, setName] = useState(puzzle.name);
  const [proof, setProof] = useState(puzzle.proof);
  const [tool, setTool] = useState<Tool>('outlet');
  const [editing, setEditing] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const code = encodeBoard(board, { solution: false });
  const latest = useRef(puzzle);
  latest.current = { ...puzzle, name: name.trim() || 'Untitled', code, proof };
  const saver = useMemo(() => new DebouncedSave<CustomPuzzle>(onSave, 400), [puzzle.id]);
  // save a pending edit when leaving, or when iOS backgrounds the app
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

  const change = (next: Board) => {
    if (encodeBoard(next, { solution: false }) === code) return; // e.g. re-tapping the current choice
    setBoard(next);
    setProof(null); // any change to the pieces needs a new solve before sharing
    saver.schedule({ ...latest.current, code: encodeBoard(next, { solution: false }), proof: null });
  };

  const tap = (cell: number) => {
    const piece = board.cells[cell]!;
    if (tool === 'erase') return piece.kind !== 'empty' && change(placePiece(board, cell, 'erase'));
    if (piece.kind === 'empty') return change(placePiece(board, cell, tool));
    if (piece.kind !== 'rock') setEditing(cell);
  };

  const canShare = useMemo(() => proofHolds(code, proof), [code, proof]);
  const issues = problems(board);

  const share = async () => setMessage(await sharePuzzle(latest.current.name, code));

  // Ask the solver: a solution it finds proves the puzzle, just like solving it yourself
  const [asking, setAsking] = useState<{ cancel(): void } | null>(null);
  useEffect(() => () => asking?.cancel(), [asking]);
  const ask = () => {
    saver.flush();
    const asked = code;
    const job = solveInWorker(asked);
    setAsking(job);
    setMessage('The solver is working on it…');
    job.result.then((r) => {
      setAsking(null);
      if (latest.current.code !== asked) return setMessage('The puzzle changed while the solver worked. Ask again.');
      if (r.status === 'solved') {
        setProof(r.solution);
        onSave({ ...latest.current, proof: r.solution });
        setMessage('The solver found a solution.');
      } else {
        setMessage("The solver couldn't find a solution in time. Solve it yourself to share it.");
      }
    }, () => {
      setAsking(null);
      setMessage("The solver couldn't finish. Solve it yourself to share it.");
    });
  };

  const test = () => {
    saver.flush();
    onSave(latest.current);
    onTest();
  };

  return (
    <main class="screen editor">
      <header class="bar">
        <a class="button" href={buildRoute({ name: 'mine' })} aria-label="Back" onClick={() => saver.flush()}>‹</a>
        <input
          class="name-input"
          value={name}
          maxLength={40}
          placeholder="Puzzle name"
          aria-label="Puzzle name"
          onInput={(e) => {
            setName((e.target as HTMLInputElement).value);
            saver.schedule({ ...latest.current, name: (e.target as HTMLInputElement).value.trim() || 'Untitled' });
          }}
        />
      </header>
      <div class="board-wrap">
        <EditorBoard board={board} onTap={tap} />
      </div>
      <div class="tools wrap-tools">
        {TOOLS.map((t) => (
          <button class={tool === t.tool ? 'on' : ''} onClick={() => setTool(t.tool)} key={t.tool}>
            {t.label}
          </button>
        ))}
      </div>
      <p class="muted status">{issues[0] ?? (canShare ? 'Solved. Ready to share.' : 'Solve it with Test to unlock Share.')}</p>
      <div class="tools">
        <button class="primary go" disabled={issues.length > 0} onClick={test}>Test</button>
        <button class="go" disabled={!canShare} onClick={() => void share()}>Share</button>
        <button disabled={issues.length > 0 || canShare || asking !== null} onClick={ask} aria-label="Ask the solver">🤖</button>
        <button
          class="danger"
          onClick={() => {
            if (!confirm(`Delete “${latest.current.name}”?`)) return;
            saver.cancel(); // a pending save would bring the puzzle back
            onDelete();
          }}
          aria-label="Delete puzzle"
        >
          🗑
        </button>
      </div>
      {message && <p class="notice">{message}</p>}
      {editing !== null && (
        <PieceSheet
          piece={board.cells[editing]!}
          onChange={(p) => change(updatePiece(board, editing, p))}
          onDelete={() => {
            change(placePiece(board, editing, 'erase'));
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </main>
  );
}


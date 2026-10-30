import type { Color, Piece, Side } from '../../engine/types.ts';
import { EDITOR_COLORS, MAX_TRAINS } from '../editor.ts';
import { TRAIN_COLORS } from '../theme/default.ts';

const SIDE_NAMES: Record<Side, string> = { 0: 'Up', 1: 'Right', 2: 'Down', 3: 'Left' };
const SIDE_ARROWS: Record<Side, string> = { 0: '↑', 1: '→', 2: '↓', 3: '←' };
const COLOR_NAMES: Record<Color, string> = { 0: 'Red', 1: 'Yellow', 2: 'Blue', 3: 'Orange', 4: 'Green', 5: 'Purple', 6: 'Brown' };
const SIDES: Side[] = [0, 1, 2, 3];

function Sides({ label, selected, multi, onChange }: { label: string; selected: Side[]; multi: boolean; onChange: (s: Side[]) => void }) {
  const toggle = (s: Side) => {
    if (!multi) return onChange([s]);
    const next = selected.includes(s) ? selected.filter((x) => x !== s) : [...selected, s].sort();
    if (next.length) onChange(next as Side[]);
  };
  return (
    <div class="sheet-row">
      <span class="label">{label}</span>
      <div class="choices">
        {SIDES.map((s) => (
          <button class={selected.includes(s) ? 'on' : ''} onClick={() => toggle(s)} aria-label={SIDE_NAMES[s]} aria-pressed={selected.includes(s)} key={s}>
            {SIDE_ARROWS[s]}
          </button>
        ))}
      </div>
    </div>
  );
}

function Swatch({ color, onClick, label }: { color: Color; onClick: () => void; label: string }) {
  return <button class="swatch" style={{ background: TRAIN_COLORS[color] }} onClick={onClick} aria-label={label} />;
}

function Trains({ label, colors, onChange }: { label: string; colors: Color[]; onChange: (c: Color[]) => void }) {
  return (
    <div class="sheet-row">
      <span class="label">{label}</span>
      <div class="choices wrap">
        {colors.map((c, i) => (
          <Swatch color={c} key={i} label={`Remove ${COLOR_NAMES[c]}`} onClick={() => colors.length > 1 && onChange(colors.filter((_, j) => j !== i))} />
        ))}
      </div>
      <span class="hint">{colors.length < MAX_TRAINS ? 'Tap a color to add a train; tap a train to remove it.' : `At most ${MAX_TRAINS} trains.`}</span>
      <div class="choices">
        {EDITOR_COLORS.map((c) => (
          <Swatch color={c} key={c} label={`Add ${COLOR_NAMES[c]}`} onClick={() => colors.length < MAX_TRAINS && onChange([...colors, c])} />
        ))}
      </div>
    </div>
  );
}

/** Edits one piece: its sides and its colors. */
export function PieceSheet({ piece, onChange, onDelete, onClose }: { piece: Piece; onChange: (p: Piece) => void; onDelete: () => void; onClose: () => void }) {
  let body = null;
  switch (piece.kind) {
    case 'outlet':
      body = (
        <>
          <Sides label="Trains leave" selected={[piece.side]} multi={false} onChange={([s]) => onChange({ ...piece, side: s! })} />
          <Trains label="Trains, in order" colors={piece.colors} onChange={(colors) => onChange({ ...piece, colors })} />
        </>
      );
      break;
    case 'goal':
      body = (
        <>
          <Sides label="Trains enter from" selected={piece.sides} multi onChange={(sides) => onChange({ ...piece, sides })} />
          <Trains label="Trains needed" colors={piece.colors} onChange={(colors) => onChange({ ...piece, colors })} />
        </>
      );
      break;
    case 'painter':
      body = (
        <>
          <div class="sheet-row">
            <span class="label">Direction</span>
            <div class="choices">
              <button class={piece.a === 3 ? 'on' : ''} onClick={() => onChange({ ...piece, a: 3, b: 1 })} aria-label="Left to right">↔</button>
              <button class={piece.a === 0 ? 'on' : ''} onClick={() => onChange({ ...piece, a: 0, b: 2 })} aria-label="Top to bottom">↕</button>
            </div>
          </div>
          <div class="sheet-row">
            <span class="label">Paints trains</span>
            <div class="choices">
              {EDITOR_COLORS.map((c) => (
                <button class={`swatch${piece.color === c ? ' on' : ''}`} style={{ background: TRAIN_COLORS[c] }} onClick={() => onChange({ ...piece, color: c })} aria-label={COLOR_NAMES[c]} key={c} />
              ))}
            </div>
          </div>
        </>
      );
      break;
    case 'splitter':
      body = <Sides label="Trains enter from" selected={[piece.in]} multi={false} onChange={([s]) => onChange({ ...piece, in: s! })} />;
      break;
  }
  const title = { outlet: 'Outlet', goal: 'Goal', painter: 'Painter', splitter: 'Splitter', rock: 'Rock' }[piece.kind as 'outlet'] ?? 'Piece';
  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <div class="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header class="bar">
          <h2>{title}</h2>
          <button onClick={onClose} aria-label="Done">Done</button>
        </header>
        {body}
        <button class="danger wide" onClick={onDelete}>Delete piece</button>
      </div>
    </div>
  );
}

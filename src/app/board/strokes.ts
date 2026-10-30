/** Follows the one finger that started a stroke; other touches are ignored until it lifts. */
export class StrokeTracker {
  private id: number | null = null;
  private cells: number[] = [];
  private moved = false;

  get active(): boolean {
    return this.id !== null;
  }

  get current(): readonly number[] {
    return this.cells;
  }

  down(id: number, cell: number): void {
    if (this.id !== null) return;
    this.id = id;
    this.cells = [cell];
    this.moved = false;
  }

  /** Returns true if the stroke reached a new cell. */
  move(id: number, cell: number): boolean {
    if (id !== this.id || cell === this.cells[this.cells.length - 1]) return false;
    this.cells.push(cell);
    this.moved = true;
    return true;
  }

  up(id: number): { cells: number[]; moved: boolean } | null {
    if (id !== this.id) return null;
    this.id = null;
    return { cells: this.cells, moved: this.moved };
  }

  cancel(id: number): void {
    if (id === this.id) this.id = null;
  }
}

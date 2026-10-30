/** Saves the latest value after a pause, and can save it at once (when leaving or backgrounding). */
export class DebouncedSave<T> {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pending: { value: T } | null = null;

  constructor(private save: (v: T) => void, private ms: number) {}

  schedule(value: T): void {
    this.pending = { value };
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.ms);
  }

  /** Drops the pending value without saving it (e.g. the thing being saved is being deleted). */
  cancel(): void {
    clearTimeout(this.timer);
    this.pending = null;
  }

  flush(): void {
    clearTimeout(this.timer);
    const p = this.pending;
    this.pending = null;
    if (p) this.save(p.value);
  }
}

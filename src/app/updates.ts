/**
 * When to switch to a newly deployed version: straight away, unless a puzzle is open,
 * in which case as soon as the player leaves it. (iPhones resume home-screen apps rather
 * than restarting them, so waiting for a restart could mean never updating.)
 */
export class Updater {
  private pending = false;

  constructor(private apply: () => void, private isSafe: () => boolean) {}

  updateFound(): void {
    this.pending = true;
    this.navigated();
  }

  navigated(): void {
    if (this.pending && this.isSafe()) {
      this.pending = false;
      this.apply();
    }
  }
}

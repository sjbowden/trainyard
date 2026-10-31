import { expect, test, vi } from 'vitest';

// A worker that never answers, like one the OS killed for memory.
class SilentWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  terminated = false;
  postMessage() {}
  terminate() {
    this.terminated = true;
  }
}

test('a worker that goes silent is stopped and reported after its budget', async () => {
  vi.useFakeTimers();
  const workers: SilentWorker[] = [];
  vi.stubGlobal('Worker', class extends SilentWorker { constructor() { super(); workers.push(this); } });
  const { solveInWorker, BUDGET_MS } = await import('../../src/app/solverClient.ts');
  const job = solveInWorker('hh002Oja3Giaa00');
  const settled = job.result.then(() => 'resolved', (e: Error) => e.message);
  await vi.advanceTimersByTimeAsync(BUDGET_MS + 10_000);
  expect(await settled).toMatch(/stopped responding/);
  expect(workers[0]!.terminated).toBe(true);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

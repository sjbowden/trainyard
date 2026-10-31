import type { Difficulty } from '../solver/difficulty.ts';
import type { Generated } from '../solver/generate.ts';
import type { SolveResult } from '../solver/solve.ts';
import type { Job } from '../solver/worker.ts';

/** The phone's time budget for one job. */
export const BUDGET_MS = 20_000;
/** A worker silent this long past its budget is assumed dead (iOS can kill it for memory without an error). */
const WATCHDOG_MS = BUDGET_MS + 8_000;
/**
 * Ask the solver's node budget. Every node keeps its layout in memory, so this bounds memory
 * (about 200 MB at 400k nodes) as well as time.
 */
export const ASK_MAX_NODES = 400_000;

/** Starts a worker job. `cancel` stops the worker at once; the promise then never settles. */
function run<T>(job: Job, onProgress?: (tried: number) => void): { result: Promise<T>; cancel(): void } {
  const worker = new Worker(new URL('../solver/worker.ts', import.meta.url), { type: 'module' });
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    clearTimeout(watchdog);
    worker.terminate();
  };
  const result = new Promise<T>((resolve, reject) => {
    watchdog = setTimeout(() => {
      stop();
      reject(new Error('The puzzle worker stopped responding.'));
    }, WATCHDOG_MS);
    worker.onmessage = (e: MessageEvent<{ type: string; tried?: number; result?: T; message?: string }>) => {
      if (e.data.type === 'progress') onProgress?.(e.data.tried!);
      else {
        stop();
        if (e.data.type === 'done') resolve(e.data.result!);
        else reject(new Error(e.data.message));
      }
    };
    worker.onerror = (e) => {
      stop();
      reject(new Error(e.message || 'The puzzle worker failed.'));
    };
  });
  worker.postMessage(job);
  return { result, cancel: stop };
}

export function generateInWorker(difficulty: Difficulty, onProgress: (tried: number) => void) {
  return run<Generated>({ type: 'generate', difficulty, budgetMs: BUDGET_MS }, onProgress);
}

export function solveInWorker(code: string) {
  return run<SolveResult>({ type: 'solve', code, budgetMs: BUDGET_MS, maxNodes: ASK_MAX_NODES });
}

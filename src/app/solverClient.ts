import type { Difficulty } from '../solver/difficulty.ts';
import type { Generated } from '../solver/generate.ts';
import type { SolveResult } from '../solver/solve.ts';
import type { Job } from '../solver/worker.ts';

/** Starts a worker job. `cancel` stops the worker at once; the promise then never settles. */
function run<T>(job: Job, onProgress?: (tried: number) => void): { result: Promise<T>; cancel(): void } {
  const worker = new Worker(new URL('../solver/worker.ts', import.meta.url), { type: 'module' });
  const result = new Promise<T>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<{ type: string; tried?: number; result?: T; message?: string }>) => {
      if (e.data.type === 'progress') onProgress?.(e.data.tried!);
      else {
        worker.terminate();
        if (e.data.type === 'done') resolve(e.data.result!);
        else reject(new Error(e.data.message));
      }
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message));
    };
  });
  worker.postMessage(job);
  return { result, cancel: () => worker.terminate() };
}

/** The phone's time budget for one job. */
export const BUDGET_MS = 20_000;

export function generateInWorker(difficulty: Difficulty, onProgress: (tried: number) => void) {
  return run<Generated>({ type: 'generate', difficulty, budgetMs: BUDGET_MS }, onProgress);
}

export function solveInWorker(code: string) {
  return run<SolveResult>({ type: 'solve', code, budgetMs: BUDGET_MS, maxNodes: 2_000_000 });
}

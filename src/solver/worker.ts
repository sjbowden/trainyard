/// <reference lib="webworker" />
import type { Difficulty } from './difficulty.ts';
import { generate } from './generate.ts';
import { solve } from './solve.ts';

/** Runs the solver and generator off the main thread. One job per worker; the client terminates it to cancel. */

export type Job = { type: 'generate'; difficulty: Difficulty; budgetMs: number } | { type: 'solve'; code: string; budgetMs: number; maxNodes: number };

self.onmessage = (e: MessageEvent<Job>) => {
  const job = e.data;
  const deadline = performance.now() + job.budgetMs;
  try {
    if (job.type === 'generate') {
      const result = generate(job.difficulty, { deadline, onProgress: (tried) => self.postMessage({ type: 'progress', tried }) });
      self.postMessage({ type: 'done', result });
    } else {
      self.postMessage({ type: 'done', result: solve(job.code, { deadline, maxNodes: job.maxNodes }) });
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err) });
  }
};

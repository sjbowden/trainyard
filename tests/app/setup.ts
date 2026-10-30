import { cleanup } from '@testing-library/preact';
import { afterEach } from 'vitest';

(globalThis as { __BUILD__?: string }).__BUILD__ = 'test';
afterEach(() => cleanup());

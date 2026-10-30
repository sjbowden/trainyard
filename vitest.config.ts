import preact from '@preact/preset-vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [preact()],
  test: {
    projects: [
      { extends: true, test: { name: 'node', include: ['tests/**/*.test.{ts,tsx}'], exclude: ['tests/app/**'] } },
      { extends: true, test: { name: 'app', include: ['tests/app/**/*.test.{ts,tsx}'], environment: 'happy-dom', setupFiles: ['tests/app/setup.ts'] } },
    ],
  },
});

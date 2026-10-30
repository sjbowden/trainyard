import { defineConfig, devices } from '@playwright/test';

// WebKit needs system libraries that aren't installed here, so this emulates an iPhone in
// Chromium. Set E2E_BROWSER=webkit to use WebKit where it is available.
const browserName = process.env.E2E_BROWSER === 'webkit' ? 'webkit' : 'chromium';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: { ...devices['iPhone 15'], browserName, baseURL: 'http://localhost:4173/trainyard/' },
  webServer: { command: 'npm run build && npx vite preview --port 4173 --strictPort', url: 'http://localhost:4173/trainyard/', reuseExistingServer: false, timeout: 120_000 },
});

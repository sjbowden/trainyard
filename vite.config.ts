import preact from '@preact/preset-vite';
import { existsSync, readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/** Dev only: serves local/collections.json (read from the APK) so puzzles can be opened with ?dev=<slug>. */
const devPuzzles: Plugin = {
  name: 'dev-puzzles',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/trainyard/__dev/collections.json', (_req, res) => {
      if (!existsSync('local/collections.json')) {
        res.statusCode = 404;
        res.end();
        return;
      }
      res.setHeader('Content-Type', 'application/json');
      res.end(readFileSync('local/collections.json'));
    });
  },
};

export default defineConfig({
  base: '/trainyard/',
  define: { __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC') },
  plugins: [
    preact(),
    devPuzzles,
    VitePWA({
      // The app decides when to switch versions (src/app/updates.ts), never mid-puzzle.
      registerType: 'prompt',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Trainyard',
        short_name: 'Trainyard',
        description: 'A personal remake of Trainyard',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b1416',
        theme_color: '#0b1416',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,png,wasm}'], maximumFileSizeToCacheInBytes: 5_000_000 },
    }),
  ],
});

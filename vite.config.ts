import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/trainyard/',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
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

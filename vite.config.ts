import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Worldwide brain-games platform — Vite + React + TS.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      // BGM tracks load on demand (browser HTTP cache) — keep them out of the
      // precache so the install payload stays lean.
      workbox: { globIgnores: ['**/bgm/**'] },
      manifest: {
        name: 'BrainClub — Worldwide Brain Games',
        short_name: 'BrainClub',
        description: 'A worldwide collection of brain & logic games. Train daily.',
        theme_color: '#0b1020',
        background_color: '#0b1020',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});

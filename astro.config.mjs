import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import pwa from '@vite-pwa/astro';

export default defineConfig({
  integrations: [
    react(),
    tailwind(),
    pwa({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'DeepLearn AI Platform',
        short_name: 'DeepLearn',
        description: 'Offline-first edge-native AI LMS',
        theme_color: '#0b1220',
        background_color: '#ffffff',
        display: 'standalone'
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}']
      }
    })
  ]
});

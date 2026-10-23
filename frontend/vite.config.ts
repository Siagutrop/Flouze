import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      manifest: {
        name: 'Flouze',
        short_name: 'Flouze',
        description: 'Budget familial par enveloppes, auto-hébergé',
        theme_color: '#0f766e',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,json}'],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});

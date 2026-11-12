import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const sha = (process.env.GITHUB_SHA ?? (() => { try { return execSync('git rev-parse HEAD').toString(); } catch { return 'dev'; } })()).slice(0, 7);
const version = `${JSON.parse(readFileSync('./package.json', 'utf8')).version} · ${sha}`;
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  base: './',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // the APK is a plain file: never answer its navigation with the app shell
        navigateFallbackDenylist: [/\.apk$/],
      },
      manifest: {
        name: 'מחמצת לעד',
        short_name: 'מחמצת',
        description: 'ניהול מחמצת ותכנון אפייה',
        lang: 'he',
        dir: 'rtl',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FFF6E5',
        theme_color: '#FFC93C',
        start_url: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
});


import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');

  // Check if we are building for Electron (usually explicitly set mode or inferred)
  // Or simply: if base is not defined in env, default to '/' for web, './' for electron specific scripts if you separate them.
  // Current script: "build": "tsc && vite build" -> This is used by Vercel.
  // "electron:build": "npm run build && electron-builder" -> This reuses the same build.
  
  // OPTIMIZED LOGIC:
  // Vercel sets 'VERCEL' env var. 
  // If running on Vercel, use '/'. 
  // If running locally for Electron build, use './'.
  const isVercel = process.env.VERCEL === '1';
  const basePath = isVercel || command === 'serve' ? '/' : './';

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
        manifest: {
          name: 'Hung Thinh ERP',
          short_name: 'ERP',
          description: 'Hệ thống quản lý ERP Hưng Thịnh',
          theme_color: '#ffffff',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    // Logic: Nếu là dev server HOẶC deploy Vercel -> dùng '/'
    // Nếu build bình thường (cho Electron) -> dùng './'
    base: basePath,
    server: {
      port: 3000
    },
    build: {
      outDir: 'dist',
      target: 'esnext'
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    }
  };
});

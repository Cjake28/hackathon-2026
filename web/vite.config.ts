import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tanstackRouter({ target: 'react' }), react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // Fixed ports for this project only. strictPort: Google sign-in only works on the exact origin http://localhost:4100.
  // host: true = reachable from other devices on the local network (http://<this-ip>:4100).
  // allowedHosts: the Cloudflare quick tunnel (HTTPS, so phones can share GPS on the Map page).
  server: {
    host: true,
    port: 4100,
    strictPort: true,
    allowedHosts: ['.trycloudflare.com'],
    proxy: { '/api': 'http://localhost:4101' },
  },
  preview: { port: 4100, strictPort: true },
});

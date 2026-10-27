import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: {
    outDir: '../dist-desktop', emptyOutDir: true, minify: true, target: 'es2020',
    // Tauri loads `index.html` from frontendDist, so the desktop entry must
    // build to the root of dist-desktop instead of preserving a nested path.
    rollupOptions: { input: fileURLToPath(new URL('./index.html', import.meta.url)) },
  },
});

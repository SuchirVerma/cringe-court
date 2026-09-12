import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // The SSE stream must not be buffered, so it is proxied straight through.
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});

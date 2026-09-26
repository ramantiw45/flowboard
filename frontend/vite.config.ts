import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `global: 'window'` polyfill is required by sockjs-client in the browser.
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'window',
  },
  server: {
    port: 5173,
  },
});

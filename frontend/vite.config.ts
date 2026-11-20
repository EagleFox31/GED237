import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { BROWSER_TARGETS } from './browserTargets';

export default defineConfig({
  server: {
    port: 5173,
    host: '0.0.0.0',
  },
  plugins: [react()],
  build: {
    target: BROWSER_TARGETS,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  base: '/edossier/'
});

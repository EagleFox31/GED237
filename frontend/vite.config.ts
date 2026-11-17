import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { parseAllowedHosts } from './vite.allowedHosts';

const allowedHosts = parseAllowedHosts(process.env.FRONTEND_ALLOWED_HOSTS);

export default defineConfig({
  server: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts,
  },
  preview: {
    allowedHosts,
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  base: '/edossier/'
});

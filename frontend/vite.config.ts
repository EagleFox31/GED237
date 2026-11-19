import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Extra host names the dev server accepts, comma-separated (e.g. a lab DNS name).
 * Empty or unset: Vite's default, which only accepts localhost and IP addresses.
 * Deliberately not VITE_-prefixed, so it stays out of the browser bundle.
 */
export function parseAllowedHosts(raw: string | undefined): string[] {
  return (raw ?? '').split(',').map((host) => host.trim()).filter(Boolean);
}

const allowedHosts = parseAllowedHosts(process.env.FRONTEND_ALLOWED_HOSTS);

export default defineConfig({
  server: {
    port: 5173,
    host: '0.0.0.0',
    ...(allowedHosts.length > 0 ? { allowedHosts } : {}),
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  base: '/edossier/'
});

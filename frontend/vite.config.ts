import fs from 'fs';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function landingAtRoot(): Plugin {
  const serveLanding = (
    req: { url?: string },
    res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (b: Buffer) => void },
    next: () => void
  ) => {
    if (req.url === '/' || req.url === '/index.html') {
      const file = path.resolve(__dirname, 'public/landing.html');
      if (fs.existsSync(file)) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(fs.readFileSync(file));
        return;
      }
    }
    next();
  };

  return {
    name: 'landing-at-root',
    configureServer(server) {
      server.middlewares.use(serveLanding);
    },
    configurePreviewServer(server) {
      server.middlewares.use(serveLanding);
    },
  };
}

export default defineConfig({
  server: {
    port: 5173,
    host: '0.0.0.0',
  },
  plugins: [react(), landingAtRoot()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  base: '/edossier/'
});

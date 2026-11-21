import { defineConfig, mergeConfig } from 'vite';
import base from '../vite.config';

/**
 * Build servi comme en production : VITE_API_URL=/api/v1 et un proxy /api vers l'API,
 * à la place de nginx (nginx/app-locations.conf). La page et l'API ont la même origine ;
 * aucun réglage CORS n'est nécessaire pour l'adresse IP du conteneur.
 * changeOrigin reste à false : l'en-tête Host d'origine est transmis, comme nginx
 * (proxy_set_header Host $http_host). Sinon la redirection du slash final de FastAPI
 * renvoie vers http://api:8000 et le navigateur la refuse (CORS).
 */
export default mergeConfig(
  base,
  defineConfig({
    preview: {
      host: '0.0.0.0',
      port: 4173,
      strictPort: true,
      proxy: { '/api': { target: process.env.LEGACY_API_TARGET || 'http://api:8000', changeOrigin: false, ws: true } },
    },
  }),
);

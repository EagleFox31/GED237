import type { PlaywrightTestConfig } from '@playwright/test';

/**
 * Moteurs anciens (LMV-1) : Chromium 109 (dernier Chrome sous Windows 7), Firefox 115 ESR,
 * Chromium 107 (avant l'unité dvh). Chaque moteur tourne dans l'image Playwright épinglée qui
 * l'embarque (docker-compose.legacy.yml) ; ce fichier reste compatible avec Playwright 1.27 à 1.64.
 *
 * L'app est ouverte par l'adresse IP du conteneur web, en HTTP : comme un poste du réseau local,
 * la page n'est pas un contexte sécurisé (pas de navigator.clipboard).
 */
const engine = process.env.LEGACY_ENGINE === 'firefox' ? 'firefox' : 'chromium';

const config: PlaywrightTestConfig = {
  testDir: '.',
  testMatch: /.*\.legacy\.spec\.ts/,
  timeout: 90_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.LEGACY_BASE_URL,
    viewport: { width: 1366, height: 768 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: process.env.LEGACY_LABEL || engine, use: { browserName: engine } }],
};
export default config;

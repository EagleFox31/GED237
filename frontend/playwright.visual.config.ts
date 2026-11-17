// Captures visuelles sur API simulée (e2e/visual/README.md) : aucune pile, seulement le build servi par `vite preview`.
// Les références vivent hors du dépôt (e2e-out/visual par défaut) : on les produit sur un build A, on compare un build B.
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const snapshotDir = process.env.VISUAL_SNAPSHOT_DIR ?? '{testDir}/../../e2e-out/visual/baseline';

export default defineConfig({
  testDir: './e2e/visual',
  testMatch: /\.visual\.ts$/,
  outputDir: 'e2e-out/visual/results',
  snapshotPathTemplate: `${snapshotDir}/{arg}{ext}`,
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://127.0.0.1:${PORT}/edossier/`,
    locale: 'fr-FR',
    timezoneId: 'Africa/Douala',
  },
  webServer: {
    // API sur la même origine (comme l'image Docker) : la maquette intercepte `/api/v1/**`.
    command: `npx vite build && npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}/edossier/`,
    env: { VITE_API_URL: '/api/v1' },
    reuseExistingServer: false,
    timeout: 180_000,
  },
});

// Specs purs (sans navigateur, sans pile, sans serveur de dev) : exécutés en CI par `npm run test:unit`.
// Tout nouveau spec pur s'ajoute au motif ci-dessous, sinon la CI ne le voit pas (cf. LESSON-2026-034).
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/specs',
  testMatch: /(safe-path|account-key|explorer-keys|features)\.spec\.ts/,
  reporter: process.env.CI ? 'dot' : 'list',
});

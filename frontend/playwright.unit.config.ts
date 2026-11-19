// Specs purs (sans navigateur, sans pile, sans serveur de dev) : exécutés en CI par `npm run test:unit`.
// Convention : tout spec pur se place dans e2e/unit/ ; ce fichier ne se modifie pas pour en ajouter un
// (cf. LESSON-2026-034 et LESSON-2026-066).
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/unit',
  reporter: process.env.CI ? 'dot' : 'list',
});

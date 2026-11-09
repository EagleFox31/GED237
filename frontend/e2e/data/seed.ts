import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Typed view of seed-manifest.json: the data backend/scripts/seed_e2e.py loads into the E2E stack.
 * Specs read names from here instead of hard-coding them, so the manifest stays the single source.
 */
export interface SeedManifest {
  schemaVersion: number;
  profile: string;
  tenant: string;
  categories: { code: string; name: string; description?: string }[];
  classification: {
    domains: { code: string; name: string; activities: { code: string; name: string }[] }[];
    rules: { code: string; name: string }[];
  };
  workflows: { code: string; name: string; routing: { code: string; name: string } }[];
  documents: { code: string; title: string; owner: string; category: string; trashed?: boolean; versions?: number }[];
  expected: {
    categories: string[];
    domains: string[];
    activities: string[];
    classificationRules: string[];
    workflowTemplates: string[];
    routingRules: string[];
    pendingTasks: Record<string, string[]>;
    trash: string[];
    versions: Record<string, number>;
  };
}

const MANIFEST_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'seed-manifest.json');

export const SEED: SeedManifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));

export function seedCategory(code: string) {
  const category = SEED.categories.find((c) => c.code === code);
  if (!category) throw new Error(`Category ${code} is not in ${MANIFEST_PATH}`);
  return category;
}

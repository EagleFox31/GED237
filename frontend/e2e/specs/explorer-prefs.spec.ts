import { test, expect } from '@playwright/test';
import {
  DEFAULT_EXPLORER_PREFS,
  EXPLORER_PREFS_KEY,
  MIN_COLUMN_WIDTH,
  clampColumnWidth,
  loadExplorerPrefs,
  nextSort,
  saveExplorerPrefs,
} from '../../profiles/tenant-admin/pages/explorerPrefs';

const memoryStorage = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
};

test.describe('Explorateur : préférences retenues (vue, tri, largeurs)', () => {
  test('rien en mémoire : valeurs par défaut (icônes, dernière mise à jour d’abord)', () => {
    expect(loadExplorerPrefs(memoryStorage())).toEqual(DEFAULT_EXPLORER_PREFS);
    expect(loadExplorerPrefs(null)).toEqual(DEFAULT_EXPLORER_PREFS);
  });

  test('aller-retour : ce qui est enregistré est relu à l’identique', () => {
    const storage = memoryStorage();
    const prefs = { view: 'details', sort: 'size', order: 'asc', widths: { document: 320, maj: 140 } } as const;
    saveExplorerPrefs({ ...prefs, widths: { ...prefs.widths } }, storage);
    expect(loadExplorerPrefs(storage)).toEqual(prefs);
  });

  test('valeurs corrompues ou inconnues : retour aux défauts, champ par champ', () => {
    expect(loadExplorerPrefs(memoryStorage({ [EXPLORER_PREFS_KEY]: '{pas du json' }))).toEqual(
      DEFAULT_EXPLORER_PREFS,
    );
    expect(loadExplorerPrefs(memoryStorage({ [EXPLORER_PREFS_KEY]: 'null' }))).toEqual(DEFAULT_EXPLORER_PREFS);
    const raw = JSON.stringify({
      view: 'liste',
      sort: 'file_path',
      order: 'up',
      widths: { document: 10, taille: 'large', inconnue: 300, maj: 5000, cible: 180 },
    });
    expect(loadExplorerPrefs(memoryStorage({ [EXPLORER_PREFS_KEY]: raw }))).toEqual({
      ...DEFAULT_EXPLORER_PREFS,
      widths: { cible: 180 },
    });
  });

  test('stockage qui lève une erreur : la page reste utilisable', () => {
    const throwing = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(loadExplorerPrefs(throwing)).toEqual(DEFAULT_EXPLORER_PREFS);
    expect(() => saveExplorerPrefs(DEFAULT_EXPLORER_PREFS, throwing)).not.toThrow();
  });

  test('clic sur un en-tête : nouvelle colonne en croissant, même colonne inversée', () => {
    expect(nextSort({ sort: 'updated_at', order: 'desc' }, 'title')).toEqual({ sort: 'title', order: 'asc' });
    expect(nextSort({ sort: 'title', order: 'asc' }, 'title')).toEqual({ sort: 'title', order: 'desc' });
    expect(nextSort({ sort: 'title', order: 'desc' }, 'title')).toEqual({ sort: 'title', order: 'asc' });
  });

  test('largeur de colonne : jamais sous le minimum', () => {
    expect(clampColumnWidth(10)).toBe(MIN_COLUMN_WIDTH);
    expect(clampColumnWidth(250.6)).toBe(251);
  });
});

import { test, expect } from '@playwright/test';
import {
  DEFAULT_EXPLORER_PREFS,
  MIN_COLUMN_WIDTH,
  clampColumnWidth,
  explorerPrefsKey,
  loadExplorerPrefs,
  nextSort,
  saveExplorerPrefs,
} from '../../profiles/tenant-admin/pages/explorerPrefs';

const memoryStorage = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
};

const ACCOUNT = 't1:A001';
const KEY = explorerPrefsKey(ACCOUNT);

test.describe('Explorateur : préférences retenues (vue, tri, largeurs)', () => {
  test('rien en mémoire : valeurs par défaut (icônes, créés récemment d’abord, comme avant)', () => {
    expect(DEFAULT_EXPLORER_PREFS).toEqual({ view: 'icons', sort: 'created_at', order: 'desc', widths: {} });
    expect(loadExplorerPrefs(ACCOUNT, memoryStorage())).toEqual(DEFAULT_EXPLORER_PREFS);
    expect(loadExplorerPrefs(ACCOUNT, null)).toEqual(DEFAULT_EXPLORER_PREFS);
  });

  test('aller-retour : ce qui est enregistré est relu à l’identique', () => {
    const storage = memoryStorage();
    const prefs = { view: 'details', sort: 'size', order: 'asc', widths: { document: 320, maj: 140 } } as const;
    saveExplorerPrefs({ ...prefs, widths: { ...prefs.widths } }, ACCOUNT, storage);
    expect(loadExplorerPrefs(ACCOUNT, storage)).toEqual(prefs);
  });

  test('deux comptes sur le même navigateur : réglages séparés', () => {
    const storage = memoryStorage();
    saveExplorerPrefs({ view: 'details', sort: 'title', order: 'asc', widths: {} }, ACCOUNT, storage);
    expect(loadExplorerPrefs('t1:B002', storage)).toEqual(DEFAULT_EXPLORER_PREFS);
  });

  test('compte non identifié : défauts, rien n’est écrit', () => {
    const storage = memoryStorage();
    saveExplorerPrefs({ view: 'details', sort: 'title', order: 'asc', widths: {} }, undefined, storage);
    expect(storage.data.size).toBe(0);
    expect(loadExplorerPrefs(undefined, storage)).toEqual(DEFAULT_EXPLORER_PREFS);
  });

  test('les défauts renvoyés sont une copie : la modifier ne fausse pas les suivants', () => {
    const first = loadExplorerPrefs(ACCOUNT, memoryStorage());
    first.sort = 'size';
    first.widths.document = 400;
    expect(first).not.toBe(DEFAULT_EXPLORER_PREFS);
    expect(loadExplorerPrefs(ACCOUNT, memoryStorage())).toEqual(DEFAULT_EXPLORER_PREFS);
  });

  test('valeurs corrompues ou inconnues : retour aux défauts, champ par champ', () => {
    expect(loadExplorerPrefs(ACCOUNT, memoryStorage({ [KEY]: '{pas du json' }))).toEqual(DEFAULT_EXPLORER_PREFS);
    expect(loadExplorerPrefs(ACCOUNT, memoryStorage({ [KEY]: 'null' }))).toEqual(DEFAULT_EXPLORER_PREFS);
    const raw = JSON.stringify({
      view: 'liste',
      sort: 'file_path',
      order: 'up',
      widths: { document: 10, taille: 'large', inconnue: 300, maj: 5000, cible: 180 },
    });
    expect(loadExplorerPrefs(ACCOUNT, memoryStorage({ [KEY]: raw }))).toEqual({
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
    expect(loadExplorerPrefs(ACCOUNT, throwing)).toEqual(DEFAULT_EXPLORER_PREFS);
    expect(() => saveExplorerPrefs({ ...DEFAULT_EXPLORER_PREFS, widths: {} }, ACCOUNT, throwing)).not.toThrow();
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

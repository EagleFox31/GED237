// Spec pur (npm run test:unit) : dépôt en série (sessionStorage, catégorie disparue, réinitialisation).
import { test, expect } from '@playwright/test';
import {
  UPLOAD_CATEGORY_STORAGE_KEY,
  UPLOAD_MODE_STORAGE_KEY,
  readUploadPreferences,
  resetForNextUpload,
  resolveStoredCategory,
  writeUploadPreferences,
  type KeyValueStorage,
} from '../../lib/uploadSeries';

function createMemoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

test.describe('Dépôt en série (UploadDocumentModal)', () => {
  test('pré-remplit la catégorie et le mode depuis sessionStorage (ged.upload.*)', () => {
    const storage = createMemoryStorage();
    writeUploadPreferences({ category: 'cat-courrier', processingMode: 'archive' }, storage);

    expect(storage.getItem(UPLOAD_CATEGORY_STORAGE_KEY)).toBe('cat-courrier');
    expect(storage.getItem(UPLOAD_MODE_STORAGE_KEY)).toBe('archive');
    expect(readUploadPreferences(storage)).toEqual({
      category: 'cat-courrier',
      processingMode: 'archive',
    });
  });

  test('retombe sur les valeurs par défaut si sessionStorage est indisponible ou lève une erreur', () => {
    const brokenStorage: KeyValueStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };

    expect(readUploadPreferences(null)).toEqual({ category: '', processingMode: 'process' });
    expect(readUploadPreferences(brokenStorage)).toEqual({
      category: '',
      processingMode: 'process',
    });
    expect(() =>
      writeUploadPreferences({ category: 'cat-1', processingMode: 'archive' }, brokenStorage),
    ).not.toThrow();
  });

  test('ignore une catégorie mémorisée qui n’existe plus dans la liste chargée', () => {
    const list = [{ id: 'cat-note' }, { id: 'cat-facture' }];
    expect(resolveStoredCategory('cat-note', list)).toBe('cat-note');
    expect(resolveStoredCategory('cat-supprimee', list)).toBe('');
    expect(resolveStoredCategory('', list)).toBe('');
  });

  test('« Déposer un autre » vide le fichier mais conserve la catégorie, le mode et les tags', () => {
    const fakeFile = { name: 'courrier-1.pdf' } as unknown as File;
    const next = resetForNextUpload({
      file: fakeFile,
      title: 'courrier-1',
      category: 'cat-courrier',
      processingMode: 'archive',
      tags: 'urgent, daf',
      description: 'Lot du matin',
    });

    expect(next.file).toBeNull();
    expect(next.title).toBe('');
    expect(next.category).toBe('cat-courrier');
    expect(next.processingMode).toBe('archive');
    expect(next.tags).toBe('urgent, daf');
    expect(next.description).toBe('Lot du matin');
  });
});

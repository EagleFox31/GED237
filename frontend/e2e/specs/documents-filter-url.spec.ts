// Spec pur (npm run test:unit) : persistance du filtre de catégorie dans l'URL (?category=).
import { test, expect } from '@playwright/test';
import {
  readCategoryFilter,
  writeCategoryFilter,
} from '../../lib/documentsUrlFilter';

test.describe('Filtre de catégorie dans l’URL (/documents)', () => {
  test('lit la catégorie depuis les paramètres d’URL', () => {
    expect(readCategoryFilter(new URLSearchParams(''))).toBe('');
    expect(readCategoryFilter(new URLSearchParams('category=cat-42'))).toBe('cat-42');
    expect(readCategoryFilter(new URLSearchParams('q=note&category=cat-42'))).toBe('cat-42');
  });

  test('écrit ou efface ?category= tout en conservant ?q= et ?open=', () => {
    const initial = new URLSearchParams('q=budget&open=doc-9');
    const withCategory = writeCategoryFilter(initial, 'cat-rh');

    expect(withCategory.get('category')).toBe('cat-rh');
    expect(withCategory.get('q')).toBe('budget');
    expect(withCategory.get('open')).toBe('doc-9');

    const cleared = writeCategoryFilter(withCategory, '');
    expect(cleared.has('category')).toBe(false);
    expect(cleared.get('q')).toBe('budget');
    expect(cleared.get('open')).toBe('doc-9');
  });
});

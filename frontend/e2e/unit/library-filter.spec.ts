// Spec pur (npm run test:unit) : recherche locale et filtres format/catégorie dans LibraryView (Lot 4, point 7).
import { test, expect } from '@playwright/test';
import {
  extractLibraryCategories,
  extractLibraryFormats,
  filterLibraryDocuments,
} from '../../lib/libraryFilter';

test.describe('Recherche et filtres Ma Bibliothèque (LibraryView)', () => {
  const docs = [
    { title: 'Note de service 14', file_type: 'pdf', category_name: 'Ressources Humaines' },
    { title: 'Budget annuel 2026', file_type: 'xlsx', category_name: 'Finances' },
    { title: 'Circulaire 02', file_type: 'pdf', category_name: 'Finances' },
  ];

  test('extrait les formats et catégories uniques triés', () => {
    expect(extractLibraryFormats(docs)).toEqual(['EXCEL', 'PDF']);
    expect(extractLibraryCategories(docs)).toEqual(['Finances', 'Ressources Humaines']);
  });

  test('filtre par texte, format et catégorie combinés', () => {
    expect(filterLibraryDocuments(docs, { query: 'note', format: '', category: '' })).toHaveLength(1);
    expect(filterLibraryDocuments(docs, { query: '', format: 'PDF', category: '' })).toHaveLength(2);
    expect(filterLibraryDocuments(docs, { query: '', format: 'PDF', category: 'Finances' })).toHaveLength(1);
    expect(filterLibraryDocuments(docs, { query: 'introuvable', format: '', category: '' })).toHaveLength(0);
  });
});

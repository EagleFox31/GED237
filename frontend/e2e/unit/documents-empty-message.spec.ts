// Spec pur (npm run test:unit) : message « aucun document » selon recherche/filtre (Lot 4 / Démo point 9).
import { test, expect } from '@playwright/test';
import {
  DOCUMENTS_EMPTY_DEFAULT,
  DOCUMENTS_EMPTY_FILTER,
  DOCUMENTS_EMPTY_SEARCH,
  emptyDocumentsMessage,
} from '../../lib/documentsEmptyMessage';

test.describe('Message liste vide Documents', () => {
  test('garde le message par défaut quand il n y a ni recherche ni filtre', () => {
    expect(emptyDocumentsMessage({})).toBe(DOCUMENTS_EMPTY_DEFAULT);
    expect(emptyDocumentsMessage({ query: '   ', status: '' })).toBe(DOCUMENTS_EMPTY_DEFAULT);
  });

  test('distingue une recherche sans résultat d un filtre sans résultat', () => {
    expect(emptyDocumentsMessage({ query: 'budget' })).toBe(DOCUMENTS_EMPTY_SEARCH);
    expect(emptyDocumentsMessage({ status: 'validated' })).toBe(DOCUMENTS_EMPTY_FILTER);
    expect(emptyDocumentsMessage({ query: 'note', status: 'draft' })).toBe(DOCUMENTS_EMPTY_SEARCH);
  });
});

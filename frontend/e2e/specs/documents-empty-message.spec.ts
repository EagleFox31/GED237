// Spec pur (npm run test:unit) : message « aucun document » selon recherche/filtre (Lot 4 / Démo point 9).
import { test, expect } from '@playwright/test';
import {
  DOCUMENTS_EMPTY_DEFAULT,
  DOCUMENTS_EMPTY_SCOPED,
  emptyDocumentsMessage,
} from '../../lib/documentsEmptyMessage';

test.describe('Message liste vide Documents (périmètre)', () => {
  test('garde le message par défaut quand il n y a ni recherche ni filtre', () => {
    expect(emptyDocumentsMessage({})).toBe(DOCUMENTS_EMPTY_DEFAULT);
    expect(emptyDocumentsMessage({ query: '   ', status: '' })).toBe(DOCUMENTS_EMPTY_DEFAULT);
  });

  test('affiche le message contextualisé au périmètre quand une recherche ou un filtre est actif', () => {
    expect(emptyDocumentsMessage({ query: 'budget' })).toBe(DOCUMENTS_EMPTY_SCOPED);
    expect(emptyDocumentsMessage({ status: 'validated' })).toBe(DOCUMENTS_EMPTY_SCOPED);
    expect(emptyDocumentsMessage({ query: 'note', status: 'draft' })).toBe(DOCUMENTS_EMPTY_SCOPED);
  });
});

import { test, expect } from '@playwright/test';
import { DOCUMENT_UNAVAILABLE, publicDetail } from '../../lib/errors/legacyDetail';

test.describe('messages anglais du backend', () => {
  test('document absent ou hors périmètre (404) : phrase claire, sans dire lequel', () => {
    expect(publicDetail('Document not found')).toBe(DOCUMENT_UNAVAILABLE);
    expect(publicDetail(' Document not found ')).toBe(DOCUMENT_UNAVAILABLE);
    expect(DOCUMENT_UNAVAILABLE).toBe("Ce document n'existe plus ou n'est pas accessible.");
  });

  test('message inconnu ou déjà en français : inchangé', () => {
    expect(publicDetail('Document introuvable.')).toBe('Document introuvable.');
    expect(publicDetail('Suppression du document impossible')).toBe('Suppression du document impossible');
    expect(publicDetail(undefined)).toBeUndefined();
    expect(publicDetail('')).toBe('');
  });
});

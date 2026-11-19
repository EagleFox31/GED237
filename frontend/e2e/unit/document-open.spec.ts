import { test, expect } from '@playwright/test';
import { OPEN_DOCUMENT_HANDLED_STATUSES, openDocumentErrorMessage } from '../../lib/documentOpen';

test.describe('Ouverture d’une fiche par lien : message selon le code HTTP', () => {
  test('404 : inexistant ou hors périmètre, même message', () => {
    expect(openDocumentErrorMessage(404)).toBe("Ce document n'existe pas ou ne vous est pas accessible.");
  });

  test('403 : pas le droit', () => {
    expect(openDocumentErrorMessage(403)).toBe("Vous n'avez pas le droit d'ouvrir ce document.");
  });

  test('autre statut : message de repli', () => {
    expect(openDocumentErrorMessage(500)).toBe('Ouverture du document impossible. Réessayez.');
  });

  test('chaque statut géré par l’écran a son propre message', () => {
    for (const status of OPEN_DOCUMENT_HANDLED_STATUSES) {
      expect(openDocumentErrorMessage(status)).not.toBe('Ouverture du document impossible. Réessayez.');
    }
  });
});

import { test, expect } from '@playwright/test';
import { VERSION_UPLOAD_HANDLED_STATUSES, versionUploadErrorMessage } from '../../lib/documentVersionUpload';

test.describe('Nouvelle version : message affiché selon le code HTTP', () => {
  test('409 : message selon le code d’erreur, insensible à la casse', () => {
    expect(versionUploadErrorMessage(409, 'IDENTICAL_TO_CURRENT')).toBe('Ce fichier est identique à la version actuelle.');
    expect(versionUploadErrorMessage(409, 'identical_to_previous_version')).toBe(
      'Ce fichier est identique à une ancienne version.',
    );
    expect(versionUploadErrorMessage(409, 'DUPLICATE_FILE')).toBe('Ce fichier existe déjà dans un autre document.');
  });

  test('409 sans code connu : message générique', () => {
    expect(versionUploadErrorMessage(409)).toBe('Ce fichier existe déjà.');
    expect(versionUploadErrorMessage(409, 'AUTRE')).toBe('Ce fichier existe déjà.');
  });

  test('413, 423, 403, 400 : messages dédiés', () => {
    expect(versionUploadErrorMessage(413)).toBe('Fichier trop volumineux.');
    expect(versionUploadErrorMessage(423, 'DOCUMENT_LOCKED')).toBe('Document réservé par une autre personne.');
    expect(versionUploadErrorMessage(403)).toBe("Vous n'avez pas le droit de modifier ce document.");
    expect(versionUploadErrorMessage(400)).toBe("Envoi impossible : votre compte n'est rattaché à aucun service.");
  });

  test('autre statut ou erreur réseau : message de repli', () => {
    expect(versionUploadErrorMessage(500)).toBe('Envoi impossible. Réessayez.');
    expect(versionUploadErrorMessage(0)).toBe('Envoi impossible. Réessayez.');
  });

  test('chaque statut géré par l’écran a son propre message', () => {
    for (const status of VERSION_UPLOAD_HANDLED_STATUSES) {
      expect(versionUploadErrorMessage(status)).not.toBe('Envoi impossible. Réessayez.');
    }
  });
});

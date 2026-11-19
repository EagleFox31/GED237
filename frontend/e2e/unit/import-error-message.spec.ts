// Spec pur (npm run test:unit) : traduction lisible des erreurs d'import en masse.
import { test, expect } from '@playwright/test';
import { formatImportError } from '../../lib/importErrorMessage';

test.describe('Erreurs lisibles import en masse (DirectoryIngestion)', () => {
  test('traduit les erreurs fréquentes en phrase courte avec conseil et garde le détail technique', () => {
    const dup = formatImportError({ status: 409, message: 'Duplicate hash abc123' }, 'Import impossible.');
    expect(dup.message).toBe('Ce document existe déjà.');
    expect(dup.technicalDetail).toBe('Duplicate hash abc123');

    const tooLarge = formatImportError(new Error('Payload too large (413)'), 'Import impossible.');
    expect(tooLarge.message).toContain('Fichier trop volumineux');
    expect(tooLarge.technicalDetail).toContain('too large');

    const corrupt = formatImportError(new Error('Encrypted PDF password required'), 'Analyse impossible.');
    expect(corrupt.message).toBe("Fichier illisible : vérifiez qu'il n'est pas protégé ou corrompu.");
    expect(corrupt.technicalDetail).toContain('Encrypted PDF');
  });

  test('propose un repli générique clair si la cause est inconnue et évite les faux positifs', () => {
    const generic = formatImportError(new Error('ERR_INTERNAL_500'), 'Import final impossible.');
    expect(generic.message).toContain('Import final impossible.');
    expect(generic.technicalDetail).toBe('ERR_INTERNAL_500');

    const ruleNotFound = formatImportError(new Error("La règle n'existe pas"), 'Analyse impossible.');
    expect(ruleNotFound.message).toContain('Analyse impossible.');

    const maxWord = formatImportError(new Error('Nombre max de fichiers dépassé'), 'Analyse impossible.');
    expect(maxWord.message).toContain('Analyse impossible.');

    const pdfWord = formatImportError(new Error('Format pdf non pris en charge'), 'Import impossible.');
    expect(pdfWord.message).toContain('Import impossible.');
  });
});

import { test, expect } from '@playwright/test';
import {
  fileTooLargeMessage, formatFileSize, maxUploadMb, nextTitle, titleFromFileName,
  unreadableFormatNotice, uploadErrorMessage,
} from '../../lib/uploadFeedback';

test.describe('uploadFeedback', () => {
  test('titre dérivé du nom de fichier', () => {
    expect(titleFromFileName('Note de service.v2.pdf')).toBe('Note de service.v2');
    expect(titleFromFileName('sans-extension')).toBe('sans-extension');
  });
  test('le titre suit le nouveau fichier tant qu’il n’est pas saisi à la main', () => {
    expect(nextTitle('ancien', false, 'nouveau.pdf')).toBe('nouveau');
    expect(nextTitle('', true, 'nouveau.pdf')).toBe('nouveau');
  });
  test('un titre saisi à la main est conservé', () => {
    expect(nextTitle('Mon titre', true, 'nouveau.pdf')).toBe('Mon titre');
  });
  test('413 : détail serveur repris, sinon message sans chiffre', () => {
    const d = 'Le fichier « X » dépasse la taille maximale autorisée (50 Mo).';
    expect(uploadErrorMessage(413, d)).toBe(d);
    expect(uploadErrorMessage(413)).toMatch(/trop volumineux/);
    expect(uploadErrorMessage(413, 'Request Entity Too Large')).toMatch(/trop volumineux/);
  });
  test('409, 400 et autres', () => {
    expect(uploadErrorMessage(409)).toMatch(/identique/);
    expect(uploadErrorMessage(400)).toMatch(/invalides/);
    expect(uploadErrorMessage(undefined)).toMatch(/connexion/);
  });
});

test.describe('contrôles avant envoi', () => {
  const MB = 1024 * 1024;
  test('limite lue au build, défaut 100 Mo si absente ou invalide', () => {
    expect(maxUploadMb('250')).toBe(250);
    for (const raw of [undefined, '', 'abc', '0', '-5', '1.5']) expect(maxUploadMb(raw)).toBe(100);
  });
  test('taille lisible en Ko puis Mo', () => {
    expect(formatFileSize(200)).toBe('1 Ko');
    expect(formatFileSize(850 * 1024)).toBe('850 Ko');
    expect(formatFileSize(12.34 * MB)).toBe('12,3 Mo');
  });
  test('fichier refusé au-delà de la limite, accepté pile à la limite', () => {
    expect(fileTooLargeMessage(100 * MB, 100)).toBeNull();
    expect(fileTooLargeMessage(100 * MB + 1, 100)).toBe(
      'Fichier trop volumineux (100,0 Mo). Maximum : 100 Mo. Compressez-le ou découpez-le.',
    );
    expect(fileTooLargeMessage(150 * MB, 100)).toMatch(/\(150,0 Mo\)\. Maximum : 100 Mo/);
  });
  test('avertissement seulement pour un format ni lisible ni affichable', () => {
    expect(unreadableFormatNotice('application/pdf', true)).toBeNull();
    expect(unreadableFormatNotice('image/jpeg', true)).toBeNull();
    expect(unreadableFormatNotice('IMAGE/PNG', false)).toBeNull();
    expect(unreadableFormatNotice('application/vnd.openxmlformats-officedocument.wordprocessingml.document', true)).toBeNull();
    expect(unreadableFormatNotice('application/zip', false)).toMatch(/sans aperçu ni recherche/);
    expect(unreadableFormatNotice('', false)).toMatch(/sans aperçu/);
  });
});

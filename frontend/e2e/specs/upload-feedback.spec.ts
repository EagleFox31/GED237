import { test, expect } from '@playwright/test';
import { isAnnouncedNetworkFailure, nextTitle, titleFromFileName, uploadErrorMessage } from '../../lib/uploadFeedback';

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
  test('coupure réseau déjà annoncée par le bandeau global : pas de second message', () => {
    expect(isAnnouncedNetworkFailure({ errorCode: 'NETWORK_UNREACHABLE', status: 0 })).toBe(true);
    expect(isAnnouncedNetworkFailure({ errorCode: 'HTTP_413', status: 413 })).toBe(false);
    expect(isAnnouncedNetworkFailure(new Error('boom'))).toBe(false);
    expect(isAnnouncedNetworkFailure(null)).toBe(false);
  });
});

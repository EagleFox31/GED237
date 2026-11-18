import { test, expect } from '@playwright/test';
import { desktopText, reconnectDelay, shouldShowDesktop, targetPath } from '../../lib/desktopNotify';

// Spec pur : exécuté par `npm run test:unit`.
test.describe('Notifications Windows : règles', () => {
  test('reconnexion : délais croissants, plafonnés à 30 s', () => {
    expect([0, 1, 2, 3].map(reconnectDelay)).toEqual([1000, 2000, 4000, 8000]);
    expect(reconnectDelay(10)).toBe(30_000);
  });

  test('affichage : demandée, autorisée, application non regardée, non lue', () => {
    const base = { enabled: true, permission: 'granted' as const, hasFocus: false, isRead: false };
    expect(shouldShowDesktop(base)).toBe(true);
    expect(shouldShowDesktop({ ...base, enabled: false })).toBe(false);
    expect(shouldShowDesktop({ ...base, permission: 'denied' })).toBe(false);
    expect(shouldShowDesktop({ ...base, permission: 'default' })).toBe(false);
    expect(shouldShowDesktop({ ...base, hasFocus: true })).toBe(false);
    expect(shouldShowDesktop({ ...base, isRead: true })).toBe(false);
  });

  test('texte : court, sans contenu du document', () => {
    const body = (event_type: string) => desktopText({ event_type }).body;
    expect(body('WORKFLOW_ASSIGNED')).toBe('Un document attend votre visa.');
    expect(body('WORKFLOW_STEP_ACCEPTED')).toBe('Un de vos documents a reçu un visa.');
    expect(body('WORKFLOW_COMPLETED')).toBe('Un de vos documents a été visé.');
    expect(body('WORKFLOW_REJECTED')).toBe('Un de vos documents a été rejeté.');
    expect(body('WORKFLOW_RETURNED')).toBe('Un de vos documents vous est renvoyé pour correction.');
    expect(body('AUTRE')).toBe('Vous avez une nouvelle notification.');
    expect(desktopText({ event_type: 'WORKFLOW_REJECTED' }).title).toBe('GED237');
  });

  test('clic : ouvre le document s\'il est connu, sinon la liste', () => {
    expect(targetPath({ event_type: 'X', meta_data: { document_id: 'a b' } })).toBe('/documents?open=a%20b');
    expect(targetPath({ event_type: 'X' })).toBe('/documents');
  });
});

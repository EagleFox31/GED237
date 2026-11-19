import { test, expect } from '@playwright/test';
import {
  canClose,
  nextSection,
  registerLoadFromError,
  registerMessage,
  schedulingEnabledFrom,
  visibleSections,
} from '../../profiles/tenant-admin/pages/reports/officialReportView';

test.describe('Copie officielle : règles d’affichage', () => {
  test('émission en cours : le modal ne se ferme pas', () => {
    expect(canClose(true)).toBe(false);
    expect(canClose(false)).toBe(true);
  });

  test('flag : « Programmés » seulement si le serveur dit true', () => {
    expect(schedulingEnabledFrom('true')).toBe(true);
    expect(schedulingEnabledFrom(' True ')).toBe(true);
    expect(schedulingEnabledFrom('false')).toBe(false);
    expect(schedulingEnabledFrom(null)).toBe(false);
    expect(schedulingEnabledFrom(undefined)).toBe(false);
    expect(schedulingEnabledFrom('1')).toBe(false);
    expect(visibleSections(false)).toEqual(['issue', 'register']);
    expect(visibleSections(true)).toEqual(['issue', 'register', 'schedules']);
  });

  test('registre : chargement, accès refusé, échec, vide, liste', () => {
    expect(registerMessage('loading', 0)).toBe('Chargement…');
    expect(registerMessage('loading', 3)).toBeNull();
    expect(registerMessage('denied', 0)).toBe("Vous n'avez pas accès au registre.");
    expect(registerMessage('denied', 3)).toBe("Vous n'avez pas accès au registre.");
    expect(registerMessage('failed', 0)).toBe('Registre indisponible pour le moment.');
    expect(registerMessage('failed', 3)).toBeNull();
    expect(registerMessage('ready', 0)).toBe('Aucune copie émise.');
    expect(registerMessage('ready', 3)).toBeNull();
  });

  test('registre : 403 distingué des autres échecs', () => {
    expect(registerLoadFromError({ status: 403 })).toBe('denied');
    expect(registerLoadFromError({ status: 500 })).toBe('failed');
    expect(registerLoadFromError(new Error('réseau'))).toBe('failed');
    expect(registerLoadFromError(null)).toBe('failed');
  });

  test('onglets : flèches en boucle, Début et Fin, autres touches ignorées', () => {
    const all = visibleSections(true);
    expect(nextSection(all, 'issue', 'ArrowRight')).toBe('register');
    expect(nextSection(all, 'schedules', 'ArrowRight')).toBe('issue');
    expect(nextSection(all, 'issue', 'ArrowLeft')).toBe('schedules');
    expect(nextSection(all, 'register', 'Home')).toBe('issue');
    expect(nextSection(all, 'issue', 'End')).toBe('schedules');
    expect(nextSection(all, 'issue', 'Enter')).toBeNull();
    expect(nextSection(visibleSections(false), 'register', 'ArrowRight')).toBe('issue');
    expect(nextSection(visibleSections(false), 'schedules', 'ArrowRight')).toBeNull();
  });
});

import { test, expect } from '@playwright/test';
import { parseApiDate, taskSubmissionLabel } from '../../lib/taskSubmission';

test.describe('taskSubmission', () => {
  test('demandeur et date d’envoi, à l’heure du Cameroun', () => {
    // 08:30 UTC (horodatage sans fuseau de l'API) = 09:30 à Douala.
    expect(taskSubmissionLabel('Awa Ndi', '2026-11-19T08:30:00')).toBe(
      'Envoyé par Awa Ndi le 19/11/2026 à 09:30',
    );
  });

  test('changement de jour : 23:30 UTC est déjà le lendemain à Douala', () => {
    expect(taskSubmissionLabel('Awa Ndi', '2026-11-19T23:30:00.123456')).toBe(
      'Envoyé par Awa Ndi le 20/11/2026 à 00:30',
    );
  });

  test('un horodatage avec fuseau est respecté', () => {
    expect(parseApiDate('2026-11-19T09:30:00+01:00')?.toISOString()).toBe('2026-11-19T08:30:00.000Z');
    expect(parseApiDate('2026-11-19T08:30:00Z')?.toISOString()).toBe('2026-11-19T08:30:00.000Z');
  });

  test('partie inconnue omise, rien si tout manque', () => {
    expect(taskSubmissionLabel('  Awa Ndi ', null)).toBe('Envoyé par Awa Ndi');
    expect(taskSubmissionLabel(null, '2026-11-19T08:30:00')).toBe('Envoyé le 19/11/2026 à 09:30');
    expect(taskSubmissionLabel('', 'pas une date')).toBeNull();
    expect(taskSubmissionLabel(undefined, undefined)).toBeNull();
  });
});

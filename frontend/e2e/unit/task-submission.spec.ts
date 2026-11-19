import { test, expect } from '@playwright/test';
import {
  parseApiDate,
  submissionAge,
  taskSubmissionLabel,
  taskSubmissionSummary,
} from '../../lib/taskSubmission';

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

  test('ancienneté : minutes, heures, jours, puis la date', () => {
    const sent = new Date('2026-11-19T08:30:00Z');
    const after = (ms: number) => new Date(sent.getTime() + ms);
    const min = 60_000;
    expect(submissionAge(sent, after(30_000))).toBe("à l'instant");
    expect(submissionAge(sent, after(-5 * min))).toBe("à l'instant");
    expect(submissionAge(sent, after(5 * min))).toBe('il y a 5 min');
    expect(submissionAge(sent, after(59 * min))).toBe('il y a 59 min');
    expect(submissionAge(sent, after(2 * 60 * min + 59 * min))).toBe('il y a 2 h');
    expect(submissionAge(sent, after(3 * 24 * 60 * min))).toBe('il y a 3 j');
    expect(submissionAge(sent, after(31 * 24 * 60 * min))).toBe('le 19/11/2026');
  });

  test('ligne visible avec ancienneté, date exacte en infobulle', () => {
    const now = new Date('2026-11-19T10:41:00Z');
    expect(taskSubmissionSummary('Awa Ndi', '2026-11-19T08:30:00', now)).toEqual({
      text: 'Envoyé par Awa Ndi il y a 2 h',
      exact: 'Envoyé par Awa Ndi le 19/11/2026 à 09:30',
    });
    expect(taskSubmissionSummary(null, '2026-11-19T08:30:00', now)?.text).toBe('Envoyé il y a 2 h');
    expect(taskSubmissionSummary('Awa Ndi', null, now)).toEqual({
      text: 'Envoyé par Awa Ndi',
      exact: 'Envoyé par Awa Ndi',
    });
    expect(taskSubmissionSummary(undefined, undefined, now)).toBeNull();
  });
});

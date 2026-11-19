import { test, expect } from '@playwright/test';
import { parseAllowedHosts } from '../../vite.allowedHosts';

test.describe('Hôtes acceptés par le serveur Vite (#145)', () => {
  test('variable absente ou vide : défaut de Vite', () => {
    expect(parseAllowedHosts(undefined)).toEqual([]);
    expect(parseAllowedHosts(' , ')).toEqual([]);
  });

  test('liste de noms, espaces et casse normalisés', () => {
    expect(parseAllowedHosts(' Poste-12, GED.local ,.intra,192.168.10.155')).toEqual([
      'poste-12',
      'ged.local',
      '.intra',
      '192.168.10.155',
    ]);
  });

  for (const raw of ['true', '*', '.', 'ged.local:8080', 'http://ged.local', 'poste 12', '*.intra']) {
    test(`refuse « ${raw} »`, () => {
      expect(() => parseAllowedHosts(raw)).toThrow(/FRONTEND_ALLOWED_HOSTS/);
    });
  }
});

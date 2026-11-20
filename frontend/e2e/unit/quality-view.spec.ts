import { test, expect } from '@playwright/test';
import {
  alertsMessage,
  documentHref,
  documentsMessage,
  formatCount,
  formatPercent,
  thresholdText,
} from '../../profiles/tenant-admin/pages/reports/qualityView';

test.describe('Onglet Qualité : règles d’affichage', () => {
  test('pourcentages et nombres au format français', () => {
    expect(formatPercent(12.5)).toBe('12,5 %');
    expect(formatPercent(33.333)).toBe('33,3 %');
    expect(formatPercent(100)).toBe('100 %');
    expect(formatPercent(null)).toBe('—');
    expect(formatPercent(undefined)).toBe('—');
    expect(formatCount(1234)).toMatch(/^1\s234$/);
  });

  test('une panne ne se lit jamais « aucun élément »', () => {
    expect(documentsMessage('failed', 0)).toBe('Liste indisponible pour le moment.');
    expect(documentsMessage('ready', 0)).toBe('Aucun document.');
    expect(documentsMessage('loading', 0)).toBeNull();
    expect(documentsMessage('failed', 3)).toBeNull();

    expect(alertsMessage('failed', 0)).toBe('Alertes indisponibles pour le moment.');
    expect(alertsMessage('ready', 0)).toBe('Aucune alerte.');
    expect(alertsMessage('loading', 0)).toBe('Chargement…');
    expect(alertsMessage('ready', 2)).toBeNull();
  });

  test('seuil en clair et lien vers la fiche', () => {
    expect(thresholdText('Sans année', 50, 'rate')).toBe('Sans année : à partir de 50 %');
    expect(thresholdText('Sans catégorie', 1200, 'count')).toMatch(/^Sans catégorie : à partir de 1\s200 documents$/);
    expect(documentHref('a b/1')).toBe('/documents?open=a%20b%2F1');
  });
});
